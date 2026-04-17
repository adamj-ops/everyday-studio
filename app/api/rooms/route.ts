import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateRoomInput } from "@/lib/specs/rooms";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateRoomInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // RLS ensures only owners can read their properties; an owned property
  // must exist before any room is created against it.
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", parsed.data.property_id)
    .maybeSingle();
  if (propertyError) {
    return NextResponse.json({ error: propertyError.message }, { status: 500 });
  }
  if (!property) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("rooms")
    .upsert(parsed.data, { onConflict: "property_id,room_type,label" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ room: data }, { status: 201 });
}
