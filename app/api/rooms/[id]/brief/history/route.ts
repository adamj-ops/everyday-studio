import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";

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
    .order("version", { ascending: false });

  if (error) {
    return internalError("room_brief_history", error);
  }

  return NextResponse.json({ versions: data ?? [] });
}
