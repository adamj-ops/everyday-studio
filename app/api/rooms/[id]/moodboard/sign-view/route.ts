import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { signStorageUrls } from "@/lib/supabase/signed-urls";

const RoomIdSchema = z.string().uuid();

const Body = z.object({
  paths: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: roomId } = await params;
  if (!RoomIdSchema.safeParse(roomId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Resolve the room's property_id and reject any path that doesn't start
  // with `{property_id}/{room_id}/` — prevents cross-room lookups even if
  // the RLS policy on the bucket accepts the read.
  const { data: room } = await supabase
    .from("rooms")
    .select("id, property_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return NextResponse.json({ error: "room_not_found" }, { status: 404 });

  const prefix = `${room.property_id}/${roomId}/`;
  const safePaths = parsed.data.paths.filter((p) => p.startsWith(prefix));
  if (safePaths.length === 0) return NextResponse.json({ urls: {} });

  try {
    const urls = await signStorageUrls(supabase, "property-references", safePaths);
    return NextResponse.json({ urls });
  } catch (err) {
    return NextResponse.json(
      { error: "sign_failed", detail: err instanceof Error ? err.message : "" },
      { status: 500 },
    );
  }
}
