import fs from "node:fs";
import path from "node:path";
import type { ReferenceMaterial } from "../specs/schema";

export type { ReferenceMaterial };

/**
 * Abstract file reader so the same reference-loading code works for local
 * test scripts (fs-backed) and the Next.js server (Supabase Storage-backed).
 * Test harnesses pass `localFsReader` explicitly. API routes in Session 3
 * will pass a Supabase-backed reader.
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

// TODO(supabase): implement supabaseStorageReader in Session 3
// that signs URLs from the `property-references` bucket and
// downloads them into the same shape.

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
