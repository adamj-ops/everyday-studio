import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runImageReview } from "@/lib/render/pipeline";
import { loadPromptInput } from "@/lib/briefs/load";

export const runtime = "nodejs";
export const maxDuration = 120;

const RenderIdSchema = z.string().uuid();

const RENDERS_BUCKET = "renders";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: renderId } = await params;
  if (!RenderIdSchema.safeParse(renderId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { data: render, error: renderErr } = await supabase
    .from("renders")
    .select("id, room_id, storage_path, status")
    .eq("id", renderId)
    .maybeSingle();
  if (renderErr) {
    return internalError("review_render_lookup", renderErr);
  }
  if (!render) {
    return NextResponse.json({ error: "render_not_found" }, { status: 404 });
  }
  if (!render.storage_path) {
    return NextResponse.json({ error: "render_has_no_image" }, { status: 400 });
  }

  // Rebuild the prompt input from the current latest brief (not the brief
  // that produced the render — review is a re-evaluation against current intent).
  const loaded = await loadPromptInput({
    supabase,
    roomId: render.room_id,
    basePhotoDescription: "Re-review of an existing render against the current brief.",
  });
  if (!loaded.ok) {
    if (loaded.error === "no_brief_for_room") {
      return NextResponse.json({ error: "no_brief_for_room" }, { status: 400 });
    }
    if (loaded.error === "room_not_found" || loaded.error === "property_not_found") {
      return NextResponse.json({ error: loaded.error }, { status: 404 });
    }
    return internalError("review_load_prompt_input", new Error(loaded.error));
  }

  const admin = createAdminClient();
  const { data: blob, error: downloadErr } = await admin.storage
    .from(RENDERS_BUCKET)
    .download(render.storage_path);
  if (downloadErr || !blob) {
    console.error("[review_image_download]", downloadErr);
    return NextResponse.json(
      { error: "internal_error", code: "review_image_download" },
      { status: 500 },
    );
  }
  const buf = Buffer.from(await blob.arrayBuffer());

  try {
    const { review, tokens } = await runImageReview({
      input: loaded.input,
      imageBase64: buf.toString("base64"),
      mimeType: blob.type || "image/png",
    });

    await admin
      .from("renders")
      .update({
        status: "complete",
        opus_verdict: mapImageVerdictToDb(review.overall_match),
        opus_critiques_json: {
          kind: "image_review",
          ...review,
        },
      })
      .eq("id", renderId);

    console.log(
      `[review_retrigger:${renderId}] verdict=${review.overall_match} ` +
        `opus_i_in=${tokens.input} opus_i_out=${tokens.output}`,
    );

    return NextResponse.json({ render_id: renderId, review });
  } catch (err) {
    console.error("[review_image_review]", err);
    return NextResponse.json(
      { error: "internal_error", code: "image_review_failed" },
      { status: 502 },
    );
  }
}

function mapImageVerdictToDb(
  verdict: "excellent" | "good" | "needs_correction" | "fail",
): "ship_it" | "revise" | "regenerate" {
  if (verdict === "excellent" || verdict === "good") return "ship_it";
  if (verdict === "needs_correction") return "revise";
  return "regenerate";
}
