import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";

// Pinned to the preview variant because that's what our validation
// testing used (Apr 2026). When Gemini 3 Pro Image exits preview,
// update this constant and re-run test-nano-banana.ts against a
// known-good fixture to confirm no regression.
export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to .env.local (scripts) or to the deployment environment (Next.js server).",
  );
}

export const geminiClient = new GoogleGenAI({ apiKey });

export interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
  commentary: string;
}

/**
 * Wraps geminiClient.models.generateContent and extracts the first inline
 * image part plus any text commentary, matching the pattern used by
 * scripts/test-nano-banana.ts and scripts/edit-nano-banana.ts.
 */
export async function generateImage(args: {
  contents: Content[];
  model?: string;
}): Promise<GenerateImageResult> {
  const model = args.model ?? GEMINI_IMAGE_MODEL;

  const response = await geminiClient.models.generateContent({
    model,
    contents: args.contents,
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let imageBase64: string | null = null;
  let mimeType: string | null = null;
  let commentary = "";

  for (const part of parts) {
    if (part.inlineData?.data && !imageBase64) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType ?? "image/png";
    } else if (part.text) {
      commentary += part.text;
    }
  }

  if (!imageBase64 || !mimeType) {
    throw new Error(
      `Gemini returned no image. Commentary: ${commentary.trim().slice(0, 500) || "(none)"}`,
    );
  }

  return { imageBase64, mimeType, commentary: commentary.trim() };
}
