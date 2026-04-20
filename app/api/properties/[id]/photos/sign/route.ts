import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { internalError } from "@/lib/api/internal-error";
import { createClient } from "@/lib/supabase/server";

// TODO(phase-2): rate-limit this endpoint. Currently safe because:
// - Internal tool, 2 users
// - RLS denies unauthorized property access
// - Signed URLs are scoped to a specific path the server controls
// If this ever goes external, add per-user rate limiting.

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

const FileDescriptor = z.object({
  filename: z.string().min(1).max(200),
  mime_type: z.string().refine((m) => ALLOWED_MIME.has(m), {
    message: "Only jpg/png/webp are accepted",
  }),
  size: z.number().int().positive().max(MAX_BYTES),
});

const SignBody = z.object({
  files: z.array(FileDescriptor).min(1).max(MAX_FILES),
});

const PropertyIdSchema = z.string().uuid();

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  if (!PropertyIdSchema.safeParse(propertyId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Verify ownership via RLS (SELECT succeeds only for the owner).
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) {
    return internalError("photos_sign_property_lookup", propertyError);
  }
  if (!property) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  const uploads = [] as Array<{
    filename: string;
    storage_path: string;
    token: string;
    signed_url: string;
  }>;

  for (const file of parsed.data.files) {
    const storagePath = `${propertyId}/${randomUUID()}.${extFromMime(file.mime_type)}`;
    const { data, error } = await supabase.storage
      .from("property-photos")
      .createSignedUploadUrl(storagePath);
    if (error || !data) {
      return internalError("photos_sign_upload_url", error ?? new Error("missing_upload_data"));
    }
    uploads.push({
      filename: file.filename,
      storage_path: storagePath,
      token: data.token,
      signed_url: data.signedUrl,
    });
  }

  return NextResponse.json({ uploads });
}
