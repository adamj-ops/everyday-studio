import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ListReferencesSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
});

const CreateReferenceSchema = z.object({
  property_id: z.string().uuid(),
  room_id: z.string().uuid().optional(),
  storage_path: z.string().min(1),
  label: z.string().min(1).max(100),
  scope: z.enum(["property", "room"]),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = ListReferencesSchema.safeParse({
    property_id: url.searchParams.get("property_id") ?? undefined,
    room_id: url.searchParams.get("room_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "not_implemented", session: 6 }, { status: 501 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateReferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "not_implemented", session: 6 }, { status: 501 });
}
