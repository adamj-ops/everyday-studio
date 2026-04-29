import { type NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runEditPipeline, PipelineParseError } from "@/lib/render/pipeline";
import { loadPromptInput } from "@/lib/briefs/load";

export const runtime = "nodejs";
export const maxDuration = 180;

const EditRenderSchema = z.object({
  render_id: z.string().uuid(),
  instruction: z.string().min(1).max(2000),
});

const RENDERS_BUCKET = "renders";
const RENDER_EXT = "png";
const RENDER_MIME = "image/png";
// Edit is cheaper than generate: just Gemini + optional Opus image review.
// Claude token costs are tiny; Gemini image is ~13 cents.
const GEMINI_COST_CENTS = 13;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = EditRenderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { render_id: parentId, instruction } = parsed.data;

  // Load the parent render (RLS-scoped so cross-user access fails here).
  const { data: parent, error: parentErr } = await supabase
    .from("renders")
    .select("id, space_id, storage_path, status")
    .eq("id", parentId)
    .maybeSingle();
  if (parentErr) {
    return internalError("edit_parent_lookup", parentErr);
  }
  if (!parent) {
    return NextResponse.json({ error: "parent_not_found" }, { status: 404 });
  }
  if (!parent.storage_path) {
    return NextResponse.json({ error: "parent_has_no_image" }, { status: 400 });
  }

  // Load the current brief + theme for the optional Opus image-review step.
  // If it's missing we still run the edit — Opus review is the only thing that
  // would skip.
  const loaded = await loadPromptInput({
    supabase,
    spaceId: parent.space_id,
    basePhotoDescription:
      "Edit of a previously-rendered kitchen. Review the edit against the current brief.",
  });
  const briefInput = loaded.ok ? loaded.input : null;

  // Download the parent image bytes.
  const admin = createAdminClient();
  const { data: parentBlob, error: downloadErr } = await admin.storage
    .from(RENDERS_BUCKET)
    .download(parent.storage_path);
  if (downloadErr || !parentBlob) {
    console.error("[edit_parent_download]", downloadErr);
    return NextResponse.json(
      { error: "internal_error", code: "edit_parent_download" },
      { status: 500 },
    );
  }
  const parentBuf = Buffer.from(await parentBlob.arrayBuffer());
  const parentImage = {
    mimeType: parentBlob.type || "image/png",
    dataBase64: parentBuf.toString("base64"),
  };

  // Resolve the property_id for the new render's storage path.
  const { data: roomRow } = await supabase
    .from("spaces")
    .select("property_id")
    .eq("id", parent.space_id)
    .maybeSingle();
  if (!roomRow) {
    return NextResponse.json({ error: "space_not_found" }, { status: 404 });
  }
  const propertyId: string = roomRow.property_id;

  // INSERT the pending renders row, pointing at the parent.
  const { data: childRow, error: insertErr } = await supabase
    .from("renders")
    .insert({
      space_id: parent.space_id,
      base_photo_id: null,
      room_spec_id: null,
      parent_render_id: parent.id,
      prompt_text: "",
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !childRow) {
    return internalError("edit_render_insert", insertErr ?? new Error("no_row"));
  }
  const renderId: string = childRow.id;

  waitUntil(
    (async () => {
      try {
        const result = await runEditPipeline({
          parentImage,
          instruction,
          briefInput,
          onStep: async (event) => {
            if (event.status !== "started") return;
            const next = statusForEditStep(event.step);
            if (!next) return;
            await admin.from("renders").update({ status: next }).eq("id", renderId);
          },
        });

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
              error_message: `edit_upload_failed: ${uploadErr.message}`,
            })
            .eq("id", renderId);
          console.error(`[edit:${renderId}] upload failed`, uploadErr.message);
          return;
        }

        const totalCents =
          opusCostCents(result.tokenUsage) + GEMINI_COST_CENTS;
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
                  edit_instruction: instruction,
                  parent_render_id: parent.id,
                  commentary: result.image.commentary,
                }
              : {
                  kind: "edit_qa_skipped",
                  edit_instruction: instruction,
                  parent_render_id: parent.id,
                  reason: result.imageReviewError ?? "no_brief_for_review",
                },
            cost_estimate_cents: totalCents,
          })
          .eq("id", renderId);

        console.log(
          `[edit:${renderId}] status=${finalStatus} opus_i_in=${result.tokenUsage.opus_image_in} opus_i_out=${result.tokenUsage.opus_image_out} total_cents=${totalCents}`,
        );
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
        console.error(`[edit:${renderId}] failed`, detail.slice(0, 400));
      }
    })(),
  );

  return NextResponse.json({ render_id: renderId, parent_render_id: parent.id }, { status: 202 });
}

function statusForEditStep(step: "gemini_edit" | "opus_image_review"): string | null {
  if (step === "gemini_edit") return "rendering";
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

function opusCostCents(usage: {
  opus_image_in: number;
  opus_image_out: number;
}): number {
  const cents =
    (usage.opus_image_in * 15) / 10000 + (usage.opus_image_out * 75) / 10000;
  return Math.round(cents);
}
