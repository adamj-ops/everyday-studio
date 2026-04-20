import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "property-photos";

/**
 * Re-encode in place so EXIF/GPS is stripped; `rotate()` honors orientation tag.
 */
export async function stripExifOverwrite(
  admin: SupabaseClient,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const { data: blob, error: downloadErr } = await admin.storage
    .from(BUCKET)
    .download(storagePath);
  if (downloadErr || !blob) {
    return { ok: false, error: downloadErr ?? new Error("empty_blob") };
  }

  const input = Buffer.from(await blob.arrayBuffer());
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "jpg";

  let output: Buffer;
  let contentType: string;
  try {
    if (ext === "png") {
      output = await sharp(input).rotate().png({ compressionLevel: 9 }).toBuffer();
      contentType = "image/png";
    } else if (ext === "webp") {
      output = await sharp(input).rotate().webp({ quality: 90 }).toBuffer();
      contentType = "image/webp";
    } else {
      output = await sharp(input).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      contentType = "image/jpeg";
    }
  } catch (err) {
    return { ok: false, error: err };
  }

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(storagePath, output, {
    contentType,
    upsert: true,
  });
  if (uploadErr) {
    return { ok: false, error: uploadErr };
  }
  return { ok: true };
}
