import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Abstract file reader so the same reference-loading code works for local
 * test scripts (fs-backed) and the Next.js server (Supabase Storage-backed).
 * Test harnesses pass `localFsReader` explicitly. Server API routes pass a
 * Supabase-backed reader built by `supabaseStorageReader`.
 */
export interface ReferenceFileReader {
  read(storagePath: string): Promise<{ mimeType: string; dataBase64: string }>;
}

function mimeFromPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export const localFsReader: ReferenceFileReader = {
  async read(storagePath) {
    const buf = fs.readFileSync(storagePath);
    return {
      mimeType: mimeFromPath(storagePath),
      dataBase64: buf.toString("base64"),
    };
  },
};

const DEFAULT_READ_TIMEOUT_MS = 10_000;

/**
 * Supabase-backed reader. Uses the service-role admin client to download
 * from the given bucket (default `property-references`). RLS is enforced
 * upstream by the API route that selects the rows — by the time a path
 * reaches this reader, ownership has already been verified.
 */
export function supabaseStorageReader(
  adminClient: SupabaseClient,
  opts: { bucket?: string; timeoutMs?: number } = {},
): ReferenceFileReader {
  const bucket = opts.bucket ?? "property-references";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS;

  return {
    async read(storagePath) {
      const download = adminClient.storage.from(bucket).download(storagePath);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `supabaseStorageReader: download timed out after ${timeoutMs}ms for ${bucket}/${storagePath}`,
              ),
            ),
          timeoutMs,
        ),
      );

      const { data, error } = await Promise.race([download, timeout]);
      if (error || !data) {
        throw new Error(
          `supabaseStorageReader: failed to download ${bucket}/${storagePath}: ${error?.message ?? "no data"}`,
        );
      }

      const buf = Buffer.from(await data.arrayBuffer());
      const mimeType = data.type || mimeFromPath(storagePath);

      return {
        mimeType,
        dataBase64: buf.toString("base64"),
      };
    },
  };
}
