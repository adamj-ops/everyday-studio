import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signStorageUrls } from "@/lib/supabase/signed-urls";

export const runtime = "nodejs";

const RenderIdSchema = z.string().uuid();

const RENDER_TTL = 24 * 60 * 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!RenderIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { data: render, error } = await supabase
    .from("renders")
    .select(
      "id, room_id, base_photo_id, room_spec_id, parent_render_id, status, storage_path, prompt_text, opus_verdict, opus_critiques_json, error_message, cost_estimate_cents, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return internalError("render_get", error);
  }
  if (!render) {
    return NextResponse.json({ error: "render_not_found" }, { status: 404 });
  }

  const { count: ordinal } = await supabase
    .from("renders")
    .select("*", { count: "exact", head: true })
    .eq("room_id", render.room_id)
    .lte("created_at", render.created_at);

  let signedUrl: string | null = null;
  if (render.storage_path) {
    // User-scoped RLS already passed (we found the row above), so if the
    // Storage RLS check disagrees for this path we still want the URL —
    // fall through to the admin client. Logging the first error helps
    // surface bucket-policy drift.
    try {
      const urls = await signStorageUrls(
        supabase,
        "renders",
        [render.storage_path],
        RENDER_TTL,
      );
      signedUrl = urls[render.storage_path] ?? null;
      if (!signedUrl) {
        console.warn(
          `[render_sign] user-scoped sign returned no url for ${render.storage_path} (render ${render.id}) — falling back to admin`,
        );
      }
    } catch (err) {
      console.warn(
        `[render_sign] user-scoped sign threw for ${render.storage_path} (render ${render.id}):`,
        err instanceof Error ? err.message : err,
      );
    }
    if (!signedUrl) {
      try {
        const admin = createAdminClient();
        const urls = await signStorageUrls(
          admin,
          "renders",
          [render.storage_path],
          RENDER_TTL,
        );
        signedUrl = urls[render.storage_path] ?? null;
        if (!signedUrl) {
          console.error(
            `[render_sign] admin sign also returned no url for ${render.storage_path} (render ${render.id})`,
          );
        }
      } catch (err) {
        console.error(
          `[render_sign] admin sign threw for ${render.storage_path} (render ${render.id}):`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return NextResponse.json({
    id: render.id,
    room_id: render.room_id,
    base_photo_id: render.base_photo_id,
    room_spec_id: render.room_spec_id,
    parent_render_id: render.parent_render_id,
    status: render.status,
    prompt_text: render.prompt_text,
    signed_url: signedUrl,
    opus_verdict: render.opus_verdict,
    opus_critiques_json: render.opus_critiques_json,
    error_message: render.error_message,
    cost_estimate_cents: render.cost_estimate_cents,
    created_at: render.created_at,
    ordinal: ordinal ?? 1,
  });
}
