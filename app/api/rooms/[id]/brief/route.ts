import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { RoomBriefSchema } from "@/lib/briefs/schema";

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

  const { data, error } = await supabase
    .from("room_briefs")
    .select(
      "id, room_id, version, creative_answers, non_negotiables, category_moodboards, created_at, updated_at",
    )
    .eq("room_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return internalError("room_brief_get", error);
  }

  return NextResponse.json({ brief: data ?? null });
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
  const parsed = RoomBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: latest, error: latestErr } = await supabase
    .from("room_briefs")
    .select("version")
    .eq("room_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    return internalError("room_brief_latest_version", latestErr);
  }

  // No prior brief + no room row visible under RLS = not found.
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
    .from("room_briefs")
    .insert({
      room_id: id,
      version: nextVersion,
      creative_answers: parsed.data.creative_answers,
      non_negotiables: parsed.data.non_negotiables,
      category_moodboards: parsed.data.category_moodboards,
    })
    .select(
      "id, room_id, version, creative_answers, non_negotiables, category_moodboards, created_at, updated_at",
    )
    .single();

  if (insertErr) {
    return internalError("room_brief_insert", insertErr);
  }

  return NextResponse.json({ brief: inserted }, { status: 201 });
}
