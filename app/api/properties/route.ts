import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { CreatePropertyInput } from "@/lib/properties/property";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return internalError("properties_list", error);

  return NextResponse.json({ properties: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreatePropertyInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({ ...parsed.data, owner_id: user.id })
    .select()
    .single();
  if (error) return internalError("properties_insert", error);

  return NextResponse.json({ property: data }, { status: 201 });
}
