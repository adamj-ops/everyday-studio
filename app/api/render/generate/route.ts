import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const GenerateRenderSchema = z.object({
  room_id: z.string().uuid(),
  base_photo_id: z.string().uuid(),
  reference_material_ids: z.array(z.string().uuid()).max(4).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = GenerateRenderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Session 6: Sonnet generates prompt -> Opus reviews -> Gemini renders
  // -> Opus QAs the render -> persist a `renders` row.
  return NextResponse.json({ error: "not_implemented", session: 6 }, { status: 501 });
}
