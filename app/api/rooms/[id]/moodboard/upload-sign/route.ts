import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;
// Per-category hard cap. Count comes from the latest room_briefs row's
// category_moodboards[category_key].image_storage_paths length; if no brief
// row exists yet, the count starts at 0.
const MAX_IMAGES_PER_CATEGORY = 10;

const RoomIdSchema = z.string().uuid();

const SignBody = z.object({
  category_key: z.string().min(1).max(80),
  filename: z.string().min(1).max(200),
  mime_type: z.string().refine((m) => ALLOWED_MIME.has(m), {
    message: "Only jpg/png/webp are accepted",
  }),
  size: z.number().int().positive().max(MAX_BYTES),
});

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

interface CategoryMoodboardRow {
  category_key: string;
  image_storage_paths?: string[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: roomId } = await params;
  if (!RoomIdSchema.safeParse(roomId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Load the room to resolve its property_id and confirm RLS visibility.
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id, property_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) {
    return NextResponse.json({ error: roomErr.message }, { status: 500 });
  }
  if (!room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  // Count existing images in this category from the latest brief row. If no
  // brief has been saved yet, the effective count is 0.
  const { data: latestBrief } = await supabase
    .from("room_briefs")
    .select("category_moodboards")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingRows = ((latestBrief?.category_moodboards ?? []) as CategoryMoodboardRow[]).filter(
    (row) => row && typeof row.category_key === "string",
  );
  const currentRow = existingRows.find((row) => row.category_key === parsed.data.category_key);
  const currentCount = Array.isArray(currentRow?.image_storage_paths)
    ? currentRow!.image_storage_paths!.length
    : 0;

  if (currentCount >= MAX_IMAGES_PER_CATEGORY) {
    return NextResponse.json(
      {
        error: "category_full",
        limit: MAX_IMAGES_PER_CATEGORY,
        current_count: currentCount,
      },
      { status: 400 },
    );
  }

  const storagePath = `${room.property_id}/${roomId}/${parsed.data.category_key}/${randomUUID()}.${extFromMime(parsed.data.mime_type)}`;

  const { data, error } = await supabase.storage
    .from("property-references")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "sign_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    storage_path: storagePath,
    token: data.token,
    signed_url: data.signedUrl,
    category_key: parsed.data.category_key,
    current_count: currentCount,
    limit: MAX_IMAGES_PER_CATEGORY,
  });
}
