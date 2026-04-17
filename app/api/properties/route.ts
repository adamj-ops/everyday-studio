import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreatePropertySchema = z.object({
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(80),
  state: z.string().length(2).default("MN"),
  zip: z.string().min(5).max(10),
  arv_estimate: z.number().nonnegative().optional(),
  buyer_persona: z.string().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ error: "not_implemented", session: 4 }, { status: 501 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "not_implemented", session: 4 }, { status: 501 });
}
