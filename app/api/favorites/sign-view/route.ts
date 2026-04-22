import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";
import { signStorageUrls } from "@/lib/supabase/signed-urls";

const Body = z.object({
  paths: z.array(z.string().min(1)).min(1).max(100),
});

/**
 * Signed GET URLs for paths the user has saved as favorites (management page, etc.).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const unique = [...new Set(parsed.data.paths)];
  const { data: favRows, error: favErr } = await supabase
    .from("saved_references")
    .select("storage_path")
    .in("storage_path", unique);
  if (favErr) {
    return internalError("favorites_sign_view_lookup", favErr);
  }

  const allowed = new Set((favRows ?? []).map((r) => r.storage_path));
  const safePaths = unique.filter((p) => allowed.has(p));
  if (safePaths.length === 0) return NextResponse.json({ urls: {} });

  try {
    const urls = await signStorageUrls(supabase, "property-references", safePaths);
    return NextResponse.json({ urls });
  } catch (err) {
    return internalError("favorites_sign_view", err);
  }
}
