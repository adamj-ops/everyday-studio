import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// room_type is plain text in the DB; Zod owns enum validation. The literals
// here mirror the discriminated union in lib/specs/schema.ts.
const RoomTypeEnum = z.enum([
  "kitchen",
  "primary_bath",
  "secondary_bath",
  "powder",
  "primary_bedroom",
  "secondary_bedroom",
  "living_room",
  "family_room",
  "dining_room",
  "foyer",
  "hallway",
  "laundry",
  "office",
]);

const CreateRoomSchema = z.object({
  property_id: z.string().uuid(),
  room_type: RoomTypeEnum,
  label: z.string().min(1).max(80),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "not_implemented", session: 4 }, { status: 501 });
}
