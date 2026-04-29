/**
 * One-off E2E runner for the moodboard render pipeline.
 *
 * Drives the same logic as `POST /api/render/generate` but uses the
 * service-role admin client directly so it can run from the terminal
 * without any session cookie or HTTP round-trip.
 *
 * Usage:
 *   tsx scripts/run-render-e2e.ts <space_id> <base_photo_id>
 *
 * Outputs a narrative of each pipeline stage + the final artifacts
 * (render storage path, Opus prompt-review verdict, Opus image-review
 * verdict). Writes the final image to test-fixtures/e2e-run-<render_id>.png
 * for easy inspection.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadPromptInput } from "../lib/briefs/load";
import { runGeneratePipeline, PipelineParseError } from "../lib/render/pipeline";
import { supabaseStorageReader } from "../lib/gemini/references";
import type { MoodboardImage } from "../lib/render/types";

function loadEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const PROPERTY_PHOTOS_BUCKET = "property-photos";
const PROPERTY_REFERENCES_BUCKET = "property-references";
const RENDERS_BUCKET = "renders";
const RENDER_EXT = "png";
const RENDER_MIME = "image/png";
const GEMINI_COST_CENTS = 13;

function divider(title: string): void {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

async function main(): Promise<void> {
  loadEnv();

  const [spaceId, basePhotoId] = process.argv.slice(2);
  if (!spaceId || !basePhotoId) {
    console.error("Usage: tsx scripts/run-render-e2e.ts <space_id> <base_photo_id>");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  divider("LOAD brief + theme + property + room");
  const photoRes = await admin
    .from("property_photos")
    .select("id, storage_path, property_id")
    .eq("id", basePhotoId)
    .maybeSingle();
  if (photoRes.error || !photoRes.data) {
    console.error("base photo not found:", photoRes.error?.message);
    process.exit(1);
  }
  const photo = photoRes.data;

  const loaded = await loadPromptInput({
    supabase: admin,
    spaceId,
    basePhotoDescription: `Before-state photo of the room (storage: ${photo.storage_path}). Designer has not provided a written description — infer the before state from the photo itself.`,
  });
  if (!loaded.ok) {
    console.error("loadPromptInput failed:", loaded.error);
    process.exit(1);
  }
  console.log("  property:", loaded.input.property.address);
  console.log("  space:", loaded.input.space.space_type, "-", loaded.input.space.label);
  console.log(
    "  theme:",
    loaded.input.project_theme
      ? `${loaded.input.project_theme.budget_tier} / ${loaded.input.project_theme.theme_preset ?? "none"}`
      : "none",
  );
  console.log(
    "  creative_answers:",
    Object.keys(loaded.input.space_brief.creative_answers).length,
    "filled",
  );
  console.log(
    "  non_negotiables:",
    loaded.input.space_brief.non_negotiables ? "yes" : "none",
  );
  console.log("  moodboard categories:", loaded.input.space_brief.category_moodboards.length);
  console.log("  reference images attached:", loaded.input.reference_images.length);

  divider("DOWNLOAD base photo + moodboard images");
  const { data: baseBlob, error: baseErr } = await admin.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .download(photo.storage_path);
  if (baseErr || !baseBlob) {
    console.error("base photo download failed:", baseErr?.message);
    process.exit(1);
  }
  const baseBuf = Buffer.from(await baseBlob.arrayBuffer());
  const basePhoto = {
    mimeType: baseBlob.type || "image/jpeg",
    dataBase64: baseBuf.toString("base64"),
  };
  console.log("  base photo:", photo.storage_path, `(${Math.round(baseBuf.length / 1024)} KB, ${basePhoto.mimeType})`);

  const reader = supabaseStorageReader(admin, { bucket: PROPERTY_REFERENCES_BUCKET });
  const moodboardImages: MoodboardImage[] = [];
  for (const ref of loaded.input.reference_images) {
    const { mimeType, dataBase64 } = await reader.read(ref.storage_path);
    moodboardImages.push({ mimeType, dataBase64 });
    console.log(`  ref (${ref.category_label}):`, ref.storage_path);
  }

  divider("INSERT pending renders row");
  const { data: renderRow, error: insertErr } = await admin
    .from("renders")
    .insert({
      space_id: spaceId,
      base_photo_id: basePhotoId,
      room_spec_id: null,
      prompt_text: "",
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !renderRow) {
    console.error("renders insert failed:", insertErr?.message);
    process.exit(1);
  }
  const renderId = renderRow.id;
  console.log("  render_id:", renderId);

  divider("RUN pipeline (Sonnet -> Opus prompt review -> Gemini -> Opus image review)");
  let result;
  try {
    result = await runGeneratePipeline({
      input: loaded.input,
      basePhoto,
      moodboardImages,
      onStep: async (event) => {
        console.log(`  [${new Date().toISOString()}] step=${event.step} status=${event.status}`, event.detail ?? "");
        if (event.status !== "started") return;
        const next = statusForStep(event.step);
        if (!next) return;
        await admin.from("renders").update({ status: next }).eq("id", renderId);
      },
    });
  } catch (err) {
    const msg =
      err instanceof PipelineParseError
        ? `parse_error[${err.step}]: ${err.rawExcerpt}`
        : err instanceof Error
          ? err.message
          : String(err);
    await admin.from("renders").update({ status: "failed", error_message: msg.slice(0, 2000) }).eq("id", renderId);
    console.error("\n  PIPELINE THREW:", msg);
    process.exit(1);
  }

  divider("RESULT");
  if (result.outcome === "gated_by_opus") {
    console.log("  OUTCOME: gated_by_opus (Opus rejected the prompt twice)");
    console.log("  Sonnet prompt preview:", result.sonnetPrompt.prompt.slice(0, 200), "...");
    console.log("  Opus issues:");
    for (const i of result.promptReview.issues) {
      console.log(`    [${i.severity}] ${i.concern} -> ${i.suggestion}`);
    }
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
    process.exit(0);
  }

  console.log("  OUTCOME: rendered");
  console.log("  Sonnet prompt length:", result.finalPrompt.length, "chars");
  console.log("  Sonnet regenerated:", result.sonnetRegenerated);
  console.log("  Prompt-review verdict:", result.promptReview.verdict);
  console.log("  Image bytes:", result.image.base64.length, "base64 chars");
  if (result.imageReview) {
    console.log("  IMAGE REVIEW:");
    console.log("    overall_match:", result.imageReview.overall_match);
    console.log("    approved_to_show_designer:", result.imageReview.approved_to_show_designer);
    console.log("    summary:", result.imageReview.summary);
    console.log("    issues:");
    for (const i of result.imageReview.issues) {
      console.log(`      [${i.severity}] ${i.element} — expected: ${i.expected} / observed: ${i.observed}`);
      console.log(`        fix: ${i.correction_hint}`);
    }
  } else {
    console.log("  IMAGE REVIEW failed:", result.imageReviewError);
  }

  divider("UPLOAD rendered image");
  const storagePath = `${photo.property_id}/${renderId}.${RENDER_EXT}`;
  const imgBuf = Buffer.from(result.image.base64, "base64");
  const { error: uploadErr } = await admin.storage
    .from(RENDERS_BUCKET)
    .upload(storagePath, imgBuf, { contentType: RENDER_MIME, upsert: true });
  if (uploadErr) {
    console.error("  upload failed:", uploadErr.message);
    await admin.from("renders").update({ status: "failed", error_message: `render_upload_failed: ${uploadErr.message}` }).eq("id", renderId);
    process.exit(1);
  }
  console.log("  uploaded:", storagePath);

  const localCopy = `test-fixtures/e2e-run-${renderId}.png`;
  fs.writeFileSync(localCopy, imgBuf);
  console.log("  local copy:", localCopy);

  const totalCents = claudeCostCents(result.tokenUsage) + GEMINI_COST_CENTS;
  const finalStatus = result.imageReview ? "complete" : "complete_qa_pending";
  await admin
    .from("renders")
    .update({
      status: finalStatus,
      prompt_text: result.finalPrompt,
      storage_path: storagePath,
      opus_verdict: result.imageReview
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

  divider("DONE");
  console.log("  final status:", finalStatus);
  console.log("  total cost cents:", totalCents);
  console.log("  render_id:", renderId);
  console.log(
    `  token usage: sonnet_in=${result.tokenUsage.sonnet_in} sonnet_out=${result.tokenUsage.sonnet_out} opus_prompt_in=${result.tokenUsage.opus_prompt_in} opus_prompt_out=${result.tokenUsage.opus_prompt_out} opus_image_in=${result.tokenUsage.opus_image_in} opus_image_out=${result.tokenUsage.opus_image_out}`,
  );
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
  const sonnetCents = (usage.sonnet_in * 3) / 10000 + (usage.sonnet_out * 15) / 10000;
  const opusCents =
    ((usage.opus_prompt_in + usage.opus_image_in) * 15) / 10000 +
    ((usage.opus_prompt_out + usage.opus_image_out) * 75) / 10000;
  return Math.round(sonnetCents + opusCents);
}

main().catch((err) => {
  console.error("unhandled:", err);
  process.exit(1);
});
