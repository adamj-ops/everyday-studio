import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const EditRenderSchema = z.object({
  render_id: z.string().uuid(),
  instruction: z.string().min(1).max(2000),
  reference_material_ids: z.array(z.string().uuid()).max(4).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = EditRenderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Session 6: conversational edit using lib/gemini/edit-prompts.ts
  // + buildContentsArray. Persist as a new `renders` row pointing at the
  // predecessor.
  return NextResponse.json({ error: "not_implemented", session: 6 }, { status: 501 });
}
