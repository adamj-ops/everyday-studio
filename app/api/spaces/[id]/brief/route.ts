import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { SpaceBriefSchema } from "@/lib/briefs/schema";

const SpaceIdSchema = z.string().uuid();

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
  if (!SpaceIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("space_briefs")
    .select(
      "id, space_id, version, surface_type, creative_answers, non_negotiables, category_moodboards, created_at, updated_at",
    )
    .eq("space_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return internalError("space_brief_get", error);
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
  if (!SpaceIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SpaceBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: latest, error: latestErr } = await supabase
    .from("space_briefs")
    .select("version")
    .eq("space_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    return internalError("space_brief_latest_version", latestErr);
  }

  // No prior brief + no space row visible under RLS = not found.
  if (!latest) {
    const { data: space } = await supabase
      .from("spaces")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!space) {
      return NextResponse.json({ error: "space_not_found" }, { status: 404 });
    }
  }

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data: inserted, error: insertErr } = await supabase
    .from("space_briefs")
    .insert({
      space_id: id,
      version: nextVersion,
      surface_type: parsed.data.surface_type,
      creative_answers: parsed.data.creative_answers,
      non_negotiables: parsed.data.non_negotiables,
      category_moodboards: parsed.data.category_moodboards,
    })
    .select(
      "id, space_id, version, surface_type, creative_answers, non_negotiables, category_moodboards, created_at, updated_at",
    )
    .single();

  if (insertErr) {
    return internalError("space_brief_insert", insertErr);
  }

  return NextResponse.json({ brief: inserted }, { status: 201 });
}
