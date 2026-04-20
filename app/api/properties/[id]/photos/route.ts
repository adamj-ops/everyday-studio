import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { stripExifOverwrite } from "@/lib/photos/strip-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RoomTypeEnum } from "@/lib/briefs/room-types";

const PropertyIdSchema = z.string().uuid();

const PROPERTY_PHOTOS_BUCKET = "property-photos";

const PhotoEntry = z.object({
  storage_path: z.string().min(1),
  room_type: RoomTypeEnum,
  room_label: z.string().min(1).max(80),
});

const FinalizeBody = z.object({
  photos: z.array(PhotoEntry).min(1).max(20),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  if (!PropertyIdSchema.safeParse(propertyId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = FinalizeBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Ownership via RLS.
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) {
    return internalError("photos_finalize_property_lookup", propertyError);
  }
  if (!property) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  // Every storage path must live under this property's folder. Prevents
  // a client from finalizing a row pointing at another property's object.
  const invalid = parsed.data.photos.find(
    (p) => !p.storage_path.startsWith(`${propertyId}/`),
  );
  if (invalid) {
    return NextResponse.json(
      { error: "storage_path_mismatch", storage_path: invalid.storage_path },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const uniquePaths = [...new Set(parsed.data.photos.map((p) => p.storage_path))];

  for (const storagePath of uniquePaths) {
    const stripped = await stripExifOverwrite(admin, storagePath);
    if (!stripped.ok) {
      console.error("[photos_finalize_strip_exif]", storagePath, stripped.error);
      return NextResponse.json(
        { error: "internal_error", code: "photos_strip_exif_failed" },
        { status: 500 },
      );
    }
  }

  // Upsert unique rooms for the (property, room_type, label) combos in the batch.
  const uniqueRooms = new Map<string, { property_id: string; room_type: string; label: string }>();
  for (const p of parsed.data.photos) {
    const key = `${p.room_type}::${p.room_label}`;
    if (!uniqueRooms.has(key)) {
      uniqueRooms.set(key, {
        property_id: propertyId,
        room_type: p.room_type,
        label: p.room_label,
      });
    }
  }

  const { error: roomsError } = await supabase
    .from("rooms")
    .upsert(Array.from(uniqueRooms.values()), {
      onConflict: "property_id,room_type,label",
    });
  if (roomsError) {
    return internalError("photos_finalize_rooms_upsert", roomsError);
  }

  const rows = parsed.data.photos.map((p) => ({
    property_id: propertyId,
    storage_path: p.storage_path,
    room_label: p.room_label,
  }));

  const { data: inserted, error: photosError } = await supabase
    .from("property_photos")
    .insert(rows)
    .select();
  if (photosError) {
    console.error("[photos_finalize_insert]", photosError);
    const { error: removeErr } = await admin.storage.from(PROPERTY_PHOTOS_BUCKET).remove(uniquePaths);
    if (removeErr) {
      console.error("[photos_finalize_rollback_storage]", removeErr);
    }
    return NextResponse.json(
      { error: "internal_error", code: "photos_finalize_insert_failed" },
      { status: 500 },
    );
  }

  // Touch parent property so dashboard ordering surfaces recently-edited rows.
  await supabase
    .from("properties")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", propertyId);

  return NextResponse.json({ photos: inserted }, { status: 201 });
}
