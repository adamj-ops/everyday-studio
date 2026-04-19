import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RoomSpecSchema, type PropertyContext, type RoomSpec } from "@/lib/specs/schema";
import { runImageReview } from "@/lib/render/pipeline";

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
    .select("id, room_id, room_spec_id, storage_path, status")
    .eq("id", renderId)
    .maybeSingle();
  if (renderErr) {
    return NextResponse.json({ error: renderErr.message }, { status: 500 });
  }
  if (!render) {
    return NextResponse.json({ error: "render_not_found" }, { status: 404 });
  }
  if (!render.storage_path) {
    return NextResponse.json(
      { error: "render_has_no_image", detail: "nothing to review" },
      { status: 400 },
    );
  }
  if (!render.room_spec_id) {
    return NextResponse.json(
      { error: "render_missing_spec_link" },
      { status: 400 },
    );
  }

  // Load the spec that was used for this render + the property context.
  const [specResult, roomResult] = await Promise.all([
    supabase.from("room_specs").select("spec_json").eq("id", render.room_spec_id).maybeSingle(),
    supabase
      .from("rooms")
      .select("id, properties(*)")
      .eq("id", render.room_id)
      .maybeSingle(),
  ]);
  if (!specResult.data) {
    return NextResponse.json({ error: "spec_not_found" }, { status: 404 });
  }
  if (!roomResult.data) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  const specParsed = RoomSpecSchema.safeParse(specResult.data.spec_json);
  if (!specParsed.success) {
    return NextResponse.json({ error: "stored_spec_invalid" }, { status: 500 });
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

  // Download the stored image.
  const admin = createAdminClient();
  const { data: blob, error: downloadErr } = await admin.storage
    .from(RENDERS_BUCKET)
    .download(render.storage_path);
  if (downloadErr || !blob) {
    return NextResponse.json(
      { error: "image_download_failed", detail: downloadErr?.message ?? "no data" },
      { status: 500 },
    );
  }
  const buf = Buffer.from(await blob.arrayBuffer());

  try {
    const { review, tokens } = await runImageReview({
      spec,
      context,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "image_review_failed", detail: message.slice(0, 500) },
      { status: 502 },
    );
  }
}

function toPropertyContext(row: Record<string, unknown>): PropertyContext {
  const arv = Number(row.arv_estimate ?? 0);
  const safeArv = Number.isFinite(arv) && arv > 0 ? arv : 1;
  return {
    address: String(row.address ?? ""),
    arv: safeArv,
    purchase_price: Math.max(1, Math.round(safeArv * 0.5)),
    rehab_budget: Math.max(1, Math.round(safeArv * 0.1)),
    buyer_persona:
      (row.buyer_persona as PropertyContext["buyer_persona"]) ?? "young_family",
    neighborhood_notes: null,
    style_direction: null,
  };
}

function mapImageVerdictToDb(
  verdict: "excellent" | "good" | "needs_correction" | "fail",
): "ship_it" | "revise" | "regenerate" {
  if (verdict === "excellent" || verdict === "good") return "ship_it";
  if (verdict === "needs_correction") return "revise";
  return "regenerate";
}
