import { type NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RoomSpecSchema,
  type PropertyContext,
  type ReferenceMaterial,
  type RoomSpec,
} from "@/lib/specs/schema";
import { supabaseStorageReader } from "@/lib/gemini/references";
import { runGeneratePipeline } from "@/lib/render/pipeline";
import { PipelineParseError } from "@/lib/render/pipeline";
import type { PipelineReference } from "@/lib/render/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  room_id: z.string().uuid(),
  base_photo_id: z.string().uuid(),
  reference_material_ids: z.array(z.string().uuid()).max(4).optional(),
  idempotency_key: z.string().uuid().optional(),
});

const PROPERTY_REFERENCES_BUCKET = "property-references";
const PROPERTY_PHOTOS_BUCKET = "property-photos";
const RENDERS_BUCKET = "renders";
// Gemini output we upload is always PNG.
const RENDER_EXT = "png";
const RENDER_MIME = "image/png";
// Flat per-render Gemini cost estimate (cents). Claude token costs are summed below.
const GEMINI_COST_CENTS = 13;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { room_id, base_photo_id, idempotency_key } = parsed.data;
  const reference_material_ids = parsed.data.reference_material_ids ?? [];

  // Idempotency — if a prior render with the same key + room exists, return it.
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("renders")
      .select("id")
      .eq("room_id", room_id)
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ render_id: existing.id, idempotent: true }, { status: 200 });
    }
  }

  // Load everything the pipeline needs under RLS.
  const [roomResult, specResult, photoResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, property_id, room_type, label, properties(*)")
      .eq("id", room_id)
      .maybeSingle(),
    supabase
      .from("room_specs")
      .select("id, version, spec_json")
      .eq("room_id", room_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("property_photos")
      .select("id, storage_path, property_id")
      .eq("id", base_photo_id)
      .maybeSingle(),
  ]);

  if (roomResult.error || !roomResult.data) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }
  if (photoResult.error || !photoResult.data) {
    return NextResponse.json({ error: "base_photo_not_found" }, { status: 404 });
  }
  if (photoResult.data.property_id !== roomResult.data.property_id) {
    return NextResponse.json(
      { error: "base_photo_not_in_property" },
      { status: 400 },
    );
  }
  if (!specResult.data) {
    return NextResponse.json({ error: "no_spec_for_room" }, { status: 400 });
  }

  const specParsed = RoomSpecSchema.safeParse(specResult.data.spec_json);
  if (!specParsed.success) {
    return NextResponse.json(
      { error: "stored_spec_invalid", details: specParsed.error.flatten() },
      { status: 500 },
    );
  }
  const spec: RoomSpec = specParsed.data;

  const rawProperties = (roomResult.data as unknown as { properties?: unknown }).properties;
  const propertyRow = Array.isArray(rawProperties)
    ? (rawProperties[0] as Record<string, unknown> | undefined)
    : (rawProperties as Record<string, unknown> | undefined);
  if (!propertyRow) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  const context = toPropertyContext(propertyRow);

  // Load the reference material rows (under RLS) and verify they all belong
  // to this property. Then prep them for the pipeline.
  let refMaterials: Array<{ row: ReferenceMaterialRow; material: ReferenceMaterial }> = [];
  if (reference_material_ids.length > 0) {
    const { data: refs, error: refsErr } = await supabase
      .from("reference_materials")
      .select("id, label, material_type, storage_path, property_id, room_id")
      .in("id", reference_material_ids);
    if (refsErr) {
      return NextResponse.json({ error: refsErr.message }, { status: 500 });
    }
    if (!refs || refs.length !== reference_material_ids.length) {
      return NextResponse.json(
        { error: "reference_material_not_found" },
        { status: 404 },
      );
    }
    for (const row of refs) {
      if (row.property_id !== roomResult.data.property_id) {
        return NextResponse.json(
          { error: "reference_not_in_property" },
          { status: 400 },
        );
      }
    }
    refMaterials = refs.map((row) => ({
      row: row as ReferenceMaterialRow,
      material: {
        id: row.id,
        label: row.label,
        material_type: (row.material_type ?? null) as ReferenceMaterial["material_type"],
        storage_path: row.storage_path,
        mime_type: "image/jpeg", // overwritten by reader
      },
    }));
  }

  // Admin client for storage read/write inside the pipeline. RLS is already
  // enforced via the selects above; the admin client is used only for
  // (a) downloading base photo + references, (b) uploading the Gemini image,
  // (c) updating the renders row across request boundaries.
  const admin = createAdminClient();

  // Download the base photo bytes.
  const { data: basePhotoBlob, error: basePhotoErr } = await admin.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .download(photoResult.data.storage_path);
  if (basePhotoErr || !basePhotoBlob) {
    return NextResponse.json(
      { error: "base_photo_download_failed", detail: basePhotoErr?.message ?? "no data" },
      { status: 500 },
    );
  }
  const basePhotoBuf = Buffer.from(await basePhotoBlob.arrayBuffer());
  const basePhoto = {
    mimeType: basePhotoBlob.type || "image/jpeg",
    dataBase64: basePhotoBuf.toString("base64"),
  };

  // Download each reference's bytes via the shared supabaseStorageReader.
  const reader = supabaseStorageReader(admin, { bucket: PROPERTY_REFERENCES_BUCKET });
  const pipelineRefs: PipelineReference[] = [];
  for (const { row, material } of refMaterials) {
    try {
      const { mimeType, dataBase64 } = await reader.read(row.storage_path);
      pipelineRefs.push({
        material: { ...material, mime_type: mimeType },
        image: { mimeType, dataBase64 },
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "reference_download_failed",
          storage_path: row.storage_path,
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  // INSERT the pending renders row now — returned to the client so they can
  // poll. prompt_text is NOT NULL; seed with '' and update after Sonnet runs.
  const { data: renderRow, error: insertErr } = await supabase
    .from("renders")
    .insert({
      room_id,
      base_photo_id,
      room_spec_id: specResult.data.id,
      prompt_text: "",
      status: "pending",
      idempotency_key: idempotency_key ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !renderRow) {
    return NextResponse.json(
      { error: "insert_failed", detail: insertErr?.message },
      { status: 500 },
    );
  }
  const renderId: string = renderRow.id;

  // Background pipeline run. waitUntil keeps the Vercel function warm until
  // the promise settles, up to maxDuration (300s on this route).
  const propertyId: string = roomResult.data.property_id;
  const basePhotoDescription = buildBasePhotoDescription(
    spec,
    String(propertyRow.address ?? ""),
  );

  waitUntil(
    (async () => {
      try {
      const result = await runGeneratePipeline({
        spec,
        context,
        basePhoto,
        basePhotoDescription,
        references: pipelineRefs,
        onStep: async (event) => {
          if (event.status !== "started") return;
          const nextStatus = statusForStep(event.step);
          if (!nextStatus) return;
          await admin
            .from("renders")
            .update({ status: nextStatus })
            .eq("id", renderId);
        },
      });

      if (result.outcome === "gated_by_opus") {
        const totalCents = claudeCostCents(result.tokenUsage);
        await admin
          .from("renders")
          .update({
            status: "gated_by_opus",
            prompt_text: result.sonnetPrompt.prompt,
            opus_critiques_json: {
              kind: "prompt_review",
              verdict: result.promptReview.verdict,
              issues: result.promptReview.issues,
              revised_prompt: result.promptReview.revised_prompt,
              sonnet_regenerated: result.sonnetRegenerated,
            },
            cost_estimate_cents: totalCents,
            error_message: "Opus rejected the prompt twice",
          })
          .eq("id", renderId);
        logPipeline(renderId, "gated_by_opus", result.tokenUsage, totalCents);
        return;
      }

      // Storage-first: upload the image bytes before updating the DB row, so
      // a DB hiccup doesn't lose the expensive Gemini asset.
      const storagePath = `${propertyId}/${renderId}.${RENDER_EXT}`;
      const imgBuf = Buffer.from(result.image.base64, "base64");
      const { error: uploadErr } = await admin.storage
        .from(RENDERS_BUCKET)
        .upload(storagePath, imgBuf, {
          contentType: RENDER_MIME,
          upsert: true,
        });
      if (uploadErr) {
        await admin
          .from("renders")
          .update({
            status: "failed",
            error_message: `render_upload_failed: ${uploadErr.message}`,
          })
          .eq("id", renderId);
        logPipeline(renderId, "failed_upload", result.tokenUsage, 0);
        return;
      }

      const totalCents = claudeCostCents(result.tokenUsage) + GEMINI_COST_CENTS;
      const finalStatus = result.imageReview ? "complete" : "complete_qa_pending";
      await admin
        .from("renders")
        .update({
          status: finalStatus,
          prompt_text: result.finalPrompt,
          storage_path: storagePath,
          opus_verdict: result.imageReview?.overall_match
            ? mapImageVerdictToDb(result.imageReview.overall_match)
            : null,
          opus_critiques_json: result.imageReview
            ? {
                kind: "image_review",
                ...result.imageReview,
                prompt_review: result.promptReview,
                sonnet_regenerated: result.sonnetRegenerated,
                commentary: result.image.commentary,
              }
            : {
                kind: "image_review_failed",
                error: result.imageReviewError,
                prompt_review: result.promptReview,
                sonnet_regenerated: result.sonnetRegenerated,
              },
          cost_estimate_cents: totalCents,
        })
        .eq("id", renderId);
      logPipeline(renderId, finalStatus, result.tokenUsage, totalCents);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const detail =
          err instanceof PipelineParseError
            ? `parse_error[${err.step}]: ${err.rawExcerpt}`
            : message;
        await admin
          .from("renders")
          .update({ status: "failed", error_message: detail.slice(0, 2000) })
          .eq("id", renderId);
        console.error(`[pipeline:${renderId}] failed`, detail.slice(0, 400));
      }
    })(),
  );

  return NextResponse.json({ render_id: renderId }, { status: 202 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ReferenceMaterialRow = {
  id: string;
  label: string;
  material_type: string | null;
  storage_path: string;
  property_id: string;
  room_id: string | null;
};

function toPropertyContext(row: Record<string, unknown>): PropertyContext {
  const arv = Number(row.arv_estimate ?? 0);
  const safeArv = Number.isFinite(arv) && arv > 0 ? arv : 1;
  return {
    address: String(row.address ?? ""),
    arv: safeArv,
    // Not tracked on `properties` yet; stub with sensible positives so
    // PropertyContextSchema.parse doesn't blow up and deriveBudgetTier
    // can still give Sonnet a signal based on ARV alone.
    purchase_price: Math.max(1, Math.round(safeArv * 0.5)),
    rehab_budget: Math.max(1, Math.round(safeArv * 0.1)),
    buyer_persona: (row.buyer_persona as PropertyContext["buyer_persona"]) ?? "young_family",
    neighborhood_notes: null,
    style_direction: null,
  };
}

function buildBasePhotoDescription(spec: RoomSpec, address: string): string {
  // We don't have an AI-generated description of the before-photo yet;
  // give Sonnet enough context to ground the REMOVE FROM ORIGINAL section.
  return `Before-state photo of the ${spec.room_type.replace(/_/g, " ")} (${spec.room_name}) at ${address}. Designer has not provided a written description — infer the before state from the photo itself.`;
}

function statusForStep(
  step: "sonnet_prompt" | "opus_prompt_review" | "gemini_render" | "opus_image_review",
): string | null {
  if (step === "sonnet_prompt") return "prompt_review";
  if (step === "opus_prompt_review") return "prompt_review";
  if (step === "gemini_render") return "rendering";
  if (step === "opus_image_review") return "image_review";
  return null;
}

function mapImageVerdictToDb(
  verdict: "excellent" | "good" | "needs_correction" | "fail",
): "ship_it" | "revise" | "regenerate" | null {
  // renders.opus_verdict was sized for the prompt-review verdicts
  // (ship_it | revise | regenerate) per migration 0001. Map the image
  // verdicts onto that set: excellent/good -> ship_it,
  // needs_correction -> revise, fail -> regenerate.
  if (verdict === "excellent" || verdict === "good") return "ship_it";
  if (verdict === "needs_correction") return "revise";
  return "regenerate";
}

function claudeCostCents(usage: {
  sonnet_in: number;
  sonnet_out: number;
  opus_prompt_in: number;
  opus_prompt_out: number;
  opus_image_in: number;
  opus_image_out: number;
}): number {
  // Rough per-token cost in cents. Sonnet ~ $3/M in, $15/M out; Opus
  // ~ $15/M in, $75/M out. Multiplied by 100 to get cents.
  const sonnetCents =
    (usage.sonnet_in * 3) / 10000 + (usage.sonnet_out * 15) / 10000;
  const opusCents =
    ((usage.opus_prompt_in + usage.opus_image_in) * 15) / 10000 +
    ((usage.opus_prompt_out + usage.opus_image_out) * 75) / 10000;
  return Math.round(sonnetCents + opusCents);
}

function logPipeline(
  renderId: string,
  finalStatus: string,
  usage: {
    sonnet_in: number;
    sonnet_out: number;
    opus_prompt_in: number;
    opus_prompt_out: number;
    opus_image_in: number;
    opus_image_out: number;
  },
  totalCents: number,
): void {
  console.log(
    `[pipeline:${renderId}] status=${finalStatus} ` +
      `sonnet_in=${usage.sonnet_in} sonnet_out=${usage.sonnet_out} ` +
      `opus_p_in=${usage.opus_prompt_in} opus_p_out=${usage.opus_prompt_out} ` +
      `opus_i_in=${usage.opus_image_in} opus_i_out=${usage.opus_image_out} ` +
      `total_cents=${totalCents}`,
  );
}
