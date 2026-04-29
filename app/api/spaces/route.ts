import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { CreateSpaceInput } from "@/lib/briefs/space-types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSpaceInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // RLS ensures only owners can read their properties; an owned property
  // must exist before any space is created against it.
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", parsed.data.property_id)
    .maybeSingle();
  if (propertyError) {
    return internalError("spaces_property_lookup", propertyError);
  }
  if (!property) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("spaces")
    .upsert(parsed.data, { onConflict: "property_id,space_type,label" })
    .select()
    .single();
  if (error) return internalError("spaces_upsert", error);

  return NextResponse.json({ space: data }, { status: 201 });
}
