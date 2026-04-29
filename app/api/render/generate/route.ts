import { type NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseStorageReader } from "@/lib/gemini/references";
import { runGeneratePipeline, PipelineParseError } from "@/lib/render/pipeline";
import { loadPromptInput } from "@/lib/briefs/load";
import type { MoodboardImage } from "@/lib/render/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  space_id: z.string().uuid(),
  base_photo_id: z.string().uuid(),
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
  const { space_id, base_photo_id, idempotency_key } = parsed.data;

  // Idempotency — if a prior render with the same key + room exists, return it.
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from("renders")
      .select("id")
      .eq("space_id", space_id)
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ render_id: existing.id, idempotent: true }, { status: 200 });
    }
  }

  const { data: photoRow, error: photoErr } = await supabase
    .from("property_photos")
    .select("id, storage_path, property_id")
    .eq("id", base_photo_id)
    .maybeSingle();
  if (photoErr || !photoRow) {
    return NextResponse.json({ error: "base_photo_not_found" }, { status: 404 });
  }

  // Load property + room + brief + theme via the shared loader (RLS-scoped).
  const loaded = await loadPromptInput({
    supabase,
    spaceId: space_id,
    basePhotoDescription: await buildBasePhotoDescriptionFromSpace(supabase, space_id, photoRow),
  });

  if (!loaded.ok) {
    if (loaded.error === "space_not_found" || loaded.error === "property_not_found") {
      return NextResponse.json({ error: loaded.error }, { status: 404 });
    }
    if (loaded.error === "no_brief_for_space") {
      return NextResponse.json({ error: "no_brief_for_space" }, { status: 400 });
    }
    return internalError("generate_load_prompt_input", new Error(loaded.error));
  }

  // Confirm the photo belongs to the same property as the room's brief.
  const { data: roomPropCheck } = await supabase
    .from("spaces")
    .select("property_id")
    .eq("id", space_id)
    .maybeSingle();
  if (!roomPropCheck || roomPropCheck.property_id !== photoRow.property_id) {
    return NextResponse.json({ error: "base_photo_not_in_property" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Download the base photo bytes.
  const { data: basePhotoBlob, error: basePhotoErr } = await admin.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .download(photoRow.storage_path);
  if (basePhotoErr || !basePhotoBlob) {
    console.error("[generate_base_photo_download]", basePhotoErr);
    return NextResponse.json(
      { error: "internal_error", code: "generate_base_photo_download" },
      { status: 500 },
    );
  }
  const basePhotoBuf = Buffer.from(await basePhotoBlob.arrayBuffer());
  const basePhoto = {
    mimeType: basePhotoBlob.type || "image/jpeg",
    dataBase64: basePhotoBuf.toString("base64"),
  };

  // Download each moodboard image in the order they appear in the brief.
  // `input.reference_images` was built with the same flattening order, so
  // Sonnet's "Image N+1" labels line up with Gemini's content array.
  const reader = supabaseStorageReader(admin, { bucket: PROPERTY_REFERENCES_BUCKET });
  const moodboardImages: MoodboardImage[] = [];
  for (const ref of loaded.input.reference_images) {
    try {
      const { mimeType, dataBase64 } = await reader.read(ref.storage_path);
      moodboardImages.push({ mimeType, dataBase64 });
    } catch (err) {
      console.error("[generate_reference_download]", ref.storage_path, err);
      return NextResponse.json(
        {
          error: "internal_error",
          code: "generate_reference_download",
          storage_path: ref.storage_path,
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
      space_id,
      base_photo_id,
      room_spec_id: null,
      prompt_text: "",
      status: "pending",
      idempotency_key: idempotency_key ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !renderRow) {
    return internalError("generate_render_insert", insertErr ?? new Error("no_row"));
  }
  const renderId: string = renderRow.id;
  const propertyId = photoRow.property_id;

  waitUntil(
    (async () => {
      try {
        const result = await runGeneratePipeline({
          input: loaded.input,
          basePhoto,
          moodboardImages,
          onStep: async (event) => {
            if (event.status !== "started") return;
            const nextStatus = statusForStep(event.step);
            if (!nextStatus) return;
            await admin.from("renders").update({ status: nextStatus }).eq("id", renderId);
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

async function buildBasePhotoDescriptionFromSpace(
  _supabase: unknown,
  _spaceId: string,
  photo: { storage_path: string },
): Promise<string> {
  // We don't have an AI-generated description of the before-photo yet; give
  // Sonnet enough context to ground the REMOVE FROM ORIGINAL section.
  return `Before-state photo of the room (storage: ${photo.storage_path}). Designer has not provided a written description — infer the before state from the photo itself.`;
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
): "ship_it" | "revise" | "regenerate" {
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
