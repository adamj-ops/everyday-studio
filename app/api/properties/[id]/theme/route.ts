import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { ProjectThemeSchema } from "@/lib/briefs/schema";

const PropertyIdSchema = z.string().uuid();

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
  if (!PropertyIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_themes")
    .select(
      "id, property_id, budget_tier, budget_custom_notes, theme_preset, theme_custom_description, created_at, updated_at",
    )
    .eq("property_id", id)
    .maybeSingle();

  if (error) {
    return internalError("project_theme_get", error);
  }

  return NextResponse.json({ theme: data ?? null });
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

  const { id } = await params;
  if (!PropertyIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProjectThemeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Confirm the user owns the property before upsert so RLS failures return
  // 404 rather than bubbling as FK errors from the insert path.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!property) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  const payload = {
    property_id: id,
    budget_tier: parsed.data.budget_tier,
    budget_custom_notes: parsed.data.budget_custom_notes ?? null,
    theme_preset: parsed.data.theme_preset ?? null,
    theme_custom_description: parsed.data.theme_custom_description ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("project_themes")
    .upsert(payload, { onConflict: "property_id" })
    .select(
      "id, property_id, budget_tier, budget_custom_notes, theme_preset, theme_custom_description, created_at, updated_at",
    )
    .single();

  if (error) {
    return internalError("project_theme_upsert", error);
  }

  return NextResponse.json({ theme: data }, { status: 200 });
}
