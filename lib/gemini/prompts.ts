import type { Content } from "@google/genai";

export const MAX_REFERENCES = 4;

export interface GeminiImageInput {
  mimeType: string;
  dataBase64: string;
}

/**
 * Assemble the Gemini `contents` array for an image-generation or edit call.
 * Order matters: the base photo comes first, any reference images follow in
 * order, then the text prompt last. Gemini treats earlier images as more
 * authoritative for geometry/layout, so the base photo must lead.
 *
 * References cap at MAX_REFERENCES (4). We throw rather than silently
 * dropping because designers will notice a missing reference and be confused.
 */
export function buildContentsArray(args: {
  basePhoto: GeminiImageInput;
  references?: GeminiImageInput[];
  promptText: string;
}): Content[] {
  const references = args.references ?? [];
  if (references.length > MAX_REFERENCES) {
    throw new Error(
      `Too many references: ${references.length}. Gemini supports at most ${MAX_REFERENCES} additional images.`,
    );
  }

  const parts: Content["parts"] = [
    { inlineData: { mimeType: args.basePhoto.mimeType, data: args.basePhoto.dataBase64 } },
    ...references.map((r) => ({
      inlineData: { mimeType: r.mimeType, data: r.dataBase64 },
    })),
    { text: args.promptText },
  ];

  return [{ role: "user", parts }];
}
