import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RoomSpecSchema } from "@/lib/specs/schema";

const RoomIdSchema = z.string().uuid();

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
  if (!RoomIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // RLS enforces ownership via room_specs policy joining through rooms -> properties.
  const { data, error } = await supabase
    .from("room_specs")
    .select("id, version, spec_json, created_at")
    .eq("room_id", id)
    .order("version", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ versions: data ?? [] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!RoomIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RoomSpecSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Look up the current max version under RLS (returns nothing if user can't see the room).
  const { data: latest, error: latestErr } = await supabase
    .from("room_specs")
    .select("version")
    .eq("room_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    return NextResponse.json({ error: latestErr.message }, { status: 500 });
  }

  // If user can't see ANY rows AND can't see the room itself, 404. Double-check
  // room visibility — RLS on room_specs insert alone doesn't prove the room exists
  // under this user's properties; catching it now is a better error than a FK fail.
  if (!latest) {
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!room) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }
  }

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data: inserted, error: insertErr } = await supabase
    .from("room_specs")
    .insert({
      room_id: id,
      spec_json: parsed.data,
      version: nextVersion,
    })
    .select("id, version, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
