import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReferenceMaterial } from "../specs/schema";

export type { ReferenceMaterial };

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
 * Supabase-backed ReferenceFileReader. Uses the service-role admin client to
 * download from the `property-references` bucket (RLS is enforced upstream in
 * the API route that selects reference_materials rows — by the time a path
 * reaches this reader, ownership has already been verified). Downloads run
 * under a timeout so a slow fetch doesn't stall the render pipeline.
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

export interface LoadedReference {
  mimeType: string;
  dataBase64: string;
  label: string;
}

export async function loadReferenceForGemini(
  ref: ReferenceMaterial,
  reader: ReferenceFileReader,
): Promise<LoadedReference> {
  const { mimeType, dataBase64 } = await reader.read(ref.storage_path);
  return {
    mimeType: ref.mime_type || mimeType,
    dataBase64,
    label: ref.label,
  };
}

/**
 * Produces the `REFERENCE IMAGES:` prompt block that gets embedded in the
 * Claude-generated render prompt. Index starts at 2 because the base photo
 * is Image 1 in the contents array.
 */
export function formatReferencesForPrompt(refs: ReferenceMaterial[]): string {
  if (refs.length === 0) return "";
  const lines = refs.map((r, i) => {
    const typePart = r.material_type ? ` [${r.material_type}]` : "";
    return `  - Image ${i + 2} (after base photo): "${r.label}"${typePart}`;
  });
  return `REFERENCE IMAGES:\n${lines.join("\n")}`;
}
