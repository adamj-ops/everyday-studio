import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { RoomTypeEnum } from "@/lib/briefs/room-types";

const IdSchema = z.string().uuid();

const PatchBodySchema = z
  .object({
    label: z.string().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    category: z.string().min(1).max(80).optional(),
    room_type: z.union([RoomTypeEnum, z.null()]).optional(),
  })
  .refine(
    (o) =>
      o.label !== undefined ||
      o.notes !== undefined ||
      o.category !== undefined ||
      o.room_type !== undefined,
    { message: "at least one field required" },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.label !== undefined) {
    patch.label = parsed.data.label === null || parsed.data.label.trim() === "" ? null : parsed.data.label.trim();
  }
  if (parsed.data.notes !== undefined) {
    patch.notes = parsed.data.notes === null || parsed.data.notes.trim() === "" ? null : parsed.data.notes.trim();
  }
  if (parsed.data.category !== undefined) {
    patch.category = parsed.data.category;
  }
  if (parsed.data.room_type !== undefined) {
    patch.room_type = parsed.data.room_type;
  }

  const { data, error } = await supabase
    .from("saved_references")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return internalError("favorites_patch", error);
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ favorite: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_references")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return internalError("favorites_delete", error);
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
