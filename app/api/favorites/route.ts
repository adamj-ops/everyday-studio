import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { userOwnsStoragePathPrefix } from "@/lib/favorites/validate-storage-path";
import { createClient } from "@/lib/supabase/server";
import { SpaceTypeEnum } from "@/lib/briefs/space-types";

const PostBodySchema = z.object({
  storage_path: z.string().min(1).max(500),
  category: z.string().min(1).max(80),
  space_type: SpaceTypeEnum.optional().nullable(),
  label: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  original_filename: z.string().max(200).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const roomTypeRaw = searchParams.get("space_type");

  if (category !== null && category !== "" && (category.length < 1 || category.length > 80)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let roomType: z.infer<typeof SpaceTypeEnum> | undefined;
  if (roomTypeRaw !== null && roomTypeRaw !== "") {
    const rt = SpaceTypeEnum.safeParse(roomTypeRaw);
    if (!rt.success) {
      return NextResponse.json({ error: "invalid_input", details: rt.error.flatten() }, { status: 400 });
    }
    roomType = rt.data;
  }

  let q = supabase.from("saved_references").select("*").order("created_at", { ascending: false });

  if (category && category.length > 0) {
    q = q.eq("category", category);
  }

  if (roomType !== undefined) {
    q = q.or(`space_type.is.null,space_type.eq.${roomType}`);
  }

  const { data, error } = await q;

  if (error) {
    return internalError("favorites_list", error);
  }

  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const okPath = await userOwnsStoragePathPrefix(supabase, user.id, parsed.data.storage_path);
  if (!okPath) {
    return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    storage_path: parsed.data.storage_path,
    category: parsed.data.category,
    space_type: parsed.data.space_type ?? null,
    label: parsed.data.label?.trim() ? parsed.data.label.trim() : null,
    notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
    original_filename: parsed.data.original_filename?.trim()
      ? parsed.data.original_filename.trim()
      : null,
  };

  const { data, error } = await supabase.from("saved_references").insert(row).select("*").single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: fetchErr } = await supabase
        .from("saved_references")
        .select("*")
        .eq("storage_path", parsed.data.storage_path)
        .maybeSingle();
      if (fetchErr || !existing) {
        return internalError("favorites_post_duplicate_fetch", fetchErr ?? new Error("missing row"));
      }
      return NextResponse.json({ favorite: existing, already_saved: true });
    }
    return internalError("favorites_post", error);
  }

  return NextResponse.json({ favorite: data });
}
