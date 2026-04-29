import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { signStorageUrls } from "@/lib/supabase/signed-urls";

const SpaceIdSchema = z.string().uuid();

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

  const { id: spaceId } = await params;
  if (!SpaceIdSchema.safeParse(spaceId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Resolve the space's property_id and reject any path that doesn't start
  // with `{property_id}/{space_id}/` — prevents cross-space lookups even if
  // the RLS policy on the bucket accepts the read.
  const { data: space } = await supabase
    .from("spaces")
    .select("id, property_id")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return NextResponse.json({ error: "space_not_found" }, { status: 404 });

  const prefix = `${space.property_id}/${spaceId}/`;
  const localPaths = parsed.data.paths.filter((p) => p.startsWith(prefix));
  const foreignPaths = [...new Set(parsed.data.paths.filter((p) => !p.startsWith(prefix)))];

  let favoritePaths: string[] = [];
  if (foreignPaths.length > 0) {
    const { data: favRows, error: favErr } = await supabase
      .from("saved_references")
      .select("storage_path")
      .in("storage_path", foreignPaths);
    if (favErr) {
      return internalError("moodboard_sign_view_favorites", favErr);
    }
    favoritePaths = (favRows ?? [])
      .map((r) => r.storage_path)
      .filter((p): p is string => typeof p === "string");
  }

  const safePaths = [...new Set([...localPaths, ...favoritePaths])];
  if (safePaths.length === 0) return NextResponse.json({ urls: {} });

  try {
    const urls = await signStorageUrls(supabase, "property-references", safePaths);
    return NextResponse.json({ urls });
  } catch (err) {
    return internalError("moodboard_sign_view", err);
  }
}
