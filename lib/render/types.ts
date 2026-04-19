import type {
  PromptReviewOutput,
  RenderPromptOutput,
  RenderReviewOutput,
} from "@/lib/claude/prompts";
import type { GeminiImageInput } from "@/lib/gemini/prompts";

export type PipelineStep =
  | "sonnet_prompt"
  | "opus_prompt_review"
  | "gemini_render"
  | "opus_image_review";

export type StepStatus = "started" | "succeeded" | "failed";

export interface StepEvent {
  step: PipelineStep;
  status: StepStatus;
  detail?: unknown;
}

export type StepHook = (event: StepEvent) => void | Promise<void>;

export interface PipelineTokenUsage {
  sonnet_in: number;
  sonnet_out: number;
  opus_prompt_in: number;
  opus_prompt_out: number;
  opus_image_in: number;
  opus_image_out: number;
}

export interface GeneratePipelineSuccess {
  outcome: "rendered";
  sonnetPrompt: RenderPromptOutput;
  sonnetRegenerated: boolean;
  promptReview: PromptReviewOutput;
  finalPrompt: string;
  image: { base64: string; mimeType: string; commentary: string };
  imageReview: RenderReviewOutput | null;
  imageReviewError: string | null;
  tokenUsage: PipelineTokenUsage;
}

export interface GeneratePipelineGated {
  outcome: "gated_by_opus";
  promptReview: PromptReviewOutput;
  sonnetPrompt: RenderPromptOutput;
  sonnetRegenerated: boolean;
  tokenUsage: PipelineTokenUsage;
}

export type GeneratePipelineResult = GeneratePipelineSuccess | GeneratePipelineGated;

export interface EditPipelineResult {
  outcome: "rendered";
  finalPrompt: string;
  image: { base64: string; mimeType: string; commentary: string };
  imageReview: RenderReviewOutput | null;
  imageReviewError: string | null;
  tokenUsage: {
    opus_image_in: number;
    opus_image_out: number;
  };
}

/**
 * Moodboard image bytes paired with index-matched metadata from
 * `RenderPromptInput.reference_images`. The pipeline passes these straight
 * into `buildContentsArray` so Gemini's multi-image content order matches
 * what Sonnet described in its prompt.
 */
export type MoodboardImage = GeminiImageInput;
