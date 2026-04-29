import type Anthropic from "@anthropic-ai/sdk";
import {
  anthropicClient,
  CLAUDE_OPERATOR_MODEL,
  CLAUDE_REVIEWER_MODEL,
} from "@/lib/claude/client";
import {
  buildRenderPromptForSurface,
  buildPromptReviewForSurface,
  buildRenderReviewRequest,
  RenderPromptOutputSchema,
  PromptReviewOutputSchema,
  RenderReviewOutputSchema,
  type PromptReviewOutput,
  type RenderPromptOutput,
  type RenderReviewOutput,
} from "@/lib/claude/prompts";
import { generateImage } from "@/lib/gemini/client";
import { buildContentsArray } from "@/lib/gemini/prompts";
import { buildEditPrompt } from "@/lib/gemini/edit-prompts";
import type { RenderPromptInput } from "@/lib/briefs/prompt-input";

import type {
  EditPipelineResult,
  EditStepHook,
  GeneratePipelineResult,
  MoodboardImage,
  PipelineTokenUsage,
  StepHook,
} from "./types";

export interface RunGeneratePipelineArgs {
  input: RenderPromptInput;
  basePhoto: { mimeType: string; dataBase64: string };
  /**
   * Moodboard image bytes, in the same order as `input.reference_images`.
   * The pipeline does not verify lengths — caller is responsible for
   * supplying exactly one entry per reference metadata entry.
   */
  moodboardImages: MoodboardImage[];
  onStep?: StepHook;
}

export async function runGeneratePipeline(
  args: RunGeneratePipelineArgs,
): Promise<GeneratePipelineResult> {
  const tokens: PipelineTokenUsage = {
    sonnet_in: 0,
    sonnet_out: 0,
    opus_prompt_in: 0,
    opus_prompt_out: 0,
    opus_image_in: 0,
    opus_image_out: 0,
  };

  // ---- 1. Sonnet: generate the Gemini render prompt -----------------------
  await emit(args.onStep, "sonnet_prompt", "started");
  const sonnetPrompt = await callSonnetPrompt({
    input: args.input,
    previousIssues: null,
    tokens,
  });
  await emit(args.onStep, "sonnet_prompt", "succeeded");

  // ---- 2. Opus: review Sonnet's prompt ------------------------------------
  await emit(args.onStep, "opus_prompt_review", "started");
  let promptReview = await callOpusPromptReview({
    input: args.input,
    generatedPrompt: sonnetPrompt.prompt,
    tokens,
  });

  let workingPrompt: RenderPromptOutput = sonnetPrompt;
  let sonnetRegenerated = false;

  if (promptReview.verdict === "regenerate") {
    const retrySonnet = await callSonnetPrompt({
      input: args.input,
      previousIssues: promptReview.issues,
      tokens,
    });
    sonnetRegenerated = true;
    workingPrompt = retrySonnet;

    const retryReview = await callOpusPromptReview({
      input: args.input,
      generatedPrompt: retrySonnet.prompt,
      tokens,
    });
    promptReview = retryReview;

    if (promptReview.verdict === "regenerate") {
      await emit(args.onStep, "opus_prompt_review", "failed", {
        reason: "regenerate_twice",
      });
      return {
        outcome: "gated_by_opus",
        promptReview,
        sonnetPrompt: retrySonnet,
        sonnetRegenerated: true,
        tokenUsage: tokens,
      };
    }
  }

  const finalPrompt =
    promptReview.verdict === "revise" && promptReview.revised_prompt
      ? promptReview.revised_prompt
      : workingPrompt.prompt;

  await emit(args.onStep, "opus_prompt_review", "succeeded", {
    verdict: promptReview.verdict,
  });

  // ---- 3. Gemini: render --------------------------------------------------
  await emit(args.onStep, "gemini_render", "started");
  const contents = buildContentsArray({
    basePhoto: args.basePhoto,
    references: args.moodboardImages,
    promptText: finalPrompt,
  });
  const image = await generateImage({ contents });
  await emit(args.onStep, "gemini_render", "succeeded", {
    mimeType: image.mimeType,
  });

  // ---- 4. Opus: image QA --------------------------------------------------
  await emit(args.onStep, "opus_image_review", "started");
  let imageReview: RenderReviewOutput | null = null;
  let imageReviewError: string | null = null;
  try {
    imageReview = await callOpusImageReview({
      input: args.input,
      imageBase64: image.imageBase64,
      mimeType: image.mimeType,
      tokens,
    });
    await emit(args.onStep, "opus_image_review", "succeeded", {
      verdict: imageReview.overall_match,
    });
  } catch (err) {
    imageReviewError = err instanceof Error ? err.message : String(err);
    await emit(args.onStep, "opus_image_review", "failed", {
      error: imageReviewError,
    });
  }

  return {
    outcome: "rendered",
    sonnetPrompt: workingPrompt,
    sonnetRegenerated,
    promptReview,
    finalPrompt,
    image: {
      base64: image.imageBase64,
      mimeType: image.mimeType,
      commentary: image.commentary,
    },
    imageReview,
    imageReviewError,
    tokenUsage: tokens,
  };
}

// ---------------------------------------------------------------------------
// Step implementations
// ---------------------------------------------------------------------------

async function callSonnetPrompt(args: {
  input: RenderPromptInput;
  previousIssues: PromptReviewOutput["issues"] | null;
  tokens: PipelineTokenUsage;
}): Promise<RenderPromptOutput> {
  const { system, user } = buildRenderPromptForSurface(args.input);

  const userMsg = args.previousIssues
    ? `${user}\n\nPREVIOUS ATTEMPT REVIEW (regenerate):\nOpus flagged the previous prompt as regenerate for the following reasons. Address each before producing the new prompt:\n${args.previousIssues
        .map((i) => `- [${i.severity}] ${i.concern} → ${i.suggestion}`)
        .join("\n")}\n\nReturn the JSON now.`
    : user;

  const response = await anthropicClient.messages.create({
    model: CLAUDE_OPERATOR_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  accumulateUsage(args.tokens, "sonnet", response.usage);

  return parseJsonResponse(response, RenderPromptOutputSchema, "sonnet_prompt");
}

async function callOpusPromptReview(args: {
  input: RenderPromptInput;
  generatedPrompt: string;
  tokens: PipelineTokenUsage;
}): Promise<PromptReviewOutput> {
  const { system, user } = buildPromptReviewForSurface({
    input: args.input,
    generated_prompt: args.generatedPrompt,
  });

  const response = await anthropicClient.messages.create({
    model: CLAUDE_REVIEWER_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  accumulateUsage(args.tokens, "opus_prompt", response.usage);

  return parseJsonResponse(response, PromptReviewOutputSchema, "opus_prompt_review");
}

/**
 * Standalone Opus image review — callable from `/api/renders/[id]/review`.
 */
export async function runImageReview(args: {
  input: RenderPromptInput;
  imageBase64: string;
  mimeType: string;
}): Promise<{
  review: RenderReviewOutput;
  tokens: { input: number; output: number };
}> {
  const tokens: PipelineTokenUsage = {
    sonnet_in: 0,
    sonnet_out: 0,
    opus_prompt_in: 0,
    opus_prompt_out: 0,
    opus_image_in: 0,
    opus_image_out: 0,
  };
  const review = await callOpusImageReview({
    input: args.input,
    imageBase64: args.imageBase64,
    mimeType: args.mimeType,
    tokens,
  });
  return {
    review,
    tokens: { input: tokens.opus_image_in, output: tokens.opus_image_out },
  };
}

async function callOpusImageReview(args: {
  input: RenderPromptInput;
  imageBase64: string;
  mimeType: string;
  tokens: PipelineTokenUsage;
}): Promise<RenderReviewOutput> {
  const { system, user } = buildRenderReviewRequest({ input: args.input });

  const response = await anthropicClient.messages.create({
    model: CLAUDE_REVIEWER_MODEL,
    max_tokens: 2048,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normalizeMediaType(args.mimeType),
              data: args.imageBase64,
            },
          },
          { type: "text", text: user },
        ],
      },
    ],
  });

  accumulateUsage(args.tokens, "opus_image", response.usage);

  return parseJsonResponse(response, RenderReviewOutputSchema, "opus_image_review");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(
  response: Anthropic.Message,
  schema: { safeParse: (x: unknown) => { success: boolean } } & {
    parse: (x: unknown) => T;
  },
  stepLabel: string,
): T {
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch (err) {
    throw new PipelineParseError(stepLabel, text, err);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new PipelineParseError(stepLabel, text, new Error("zod_validation_failed"));
  }
  return schema.parse(raw);
}

function accumulateUsage(
  tokens: PipelineTokenUsage,
  kind: "sonnet" | "opus_prompt" | "opus_image",
  usage: Anthropic.Message["usage"] | undefined,
): void {
  if (!usage) return;
  if (kind === "sonnet") {
    tokens.sonnet_in += usage.input_tokens ?? 0;
    tokens.sonnet_out += usage.output_tokens ?? 0;
  } else if (kind === "opus_prompt") {
    tokens.opus_prompt_in += usage.input_tokens ?? 0;
    tokens.opus_prompt_out += usage.output_tokens ?? 0;
  } else {
    tokens.opus_image_in += usage.input_tokens ?? 0;
    tokens.opus_image_out += usage.output_tokens ?? 0;
  }
}

function normalizeMediaType(mime: string): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp" || mime === "image/gif") {
    return mime;
  }
  return "image/png";
}

async function emit(
  hook: StepHook | undefined,
  step: Parameters<StepHook>[0]["step"],
  status: Parameters<StepHook>[0]["status"],
  detail?: unknown,
): Promise<void> {
  if (!hook) return;
  await hook({ step, status, detail });
}

export class PipelineParseError extends Error {
  readonly step: string;
  readonly rawExcerpt: string;
  constructor(step: string, raw: string, cause: unknown) {
    super(`pipeline[${step}] parse error: ${cause instanceof Error ? cause.message : "unknown"}`);
    this.name = "PipelineParseError";
    this.step = step;
    this.rawExcerpt = raw.slice(0, 400);
  }
}

// ---------------------------------------------------------------------------
// Edit pipeline — conversational edits on a prior render
// ---------------------------------------------------------------------------

export interface RunEditPipelineArgs {
  /**
   * The render we're editing — its image bytes are passed to Gemini as the
   * base photo. Gemini produces a new image; we persist it as a new renders
   * row pointing at this one via parent_render_id.
   */
  parentImage: { mimeType: string; dataBase64: string };
  /**
   * Free-text designer instruction, e.g. "Remove the second refrigerator,
   * keep only the panel-ready one clad in cabinet panels."
   */
  instruction: string;
  /**
   * The latest brief + theme input. Used only by the Opus image-review
   * step at the end — we re-grade the edit against current brief intent.
   * Pass null to skip image review (e.g. for a quick iteration loop).
   */
  briefInput: RenderPromptInput | null;
  onStep?: EditStepHook;
}

/**
 * Conversational edit: single Gemini call that applies a targeted change to
 * the prior render while preserving everything else. Optionally re-reviewed
 * by Opus against the current brief. Cheaper than a full generate (~$0.20
 * vs ~$0.30) because there is no Sonnet and no prompt-review step — the
 * designer's instruction IS the prompt, wrapped by `buildEditPrompt`.
 */
export async function runEditPipeline(
  args: RunEditPipelineArgs,
): Promise<EditPipelineResult> {
  const tokens: PipelineTokenUsage = {
    sonnet_in: 0,
    sonnet_out: 0,
    opus_prompt_in: 0,
    opus_prompt_out: 0,
    opus_image_in: 0,
    opus_image_out: 0,
  };

  // 1. Gemini edit — parent image + wrapped instruction
  await emitEdit(args.onStep, "gemini_edit", "started");
  const editPrompt = buildEditPrompt({ instruction: args.instruction });
  const contents = buildContentsArray({
    basePhoto: args.parentImage,
    references: [],
    promptText: editPrompt,
  });
  const image = await generateImage({ contents });
  await emitEdit(args.onStep, "gemini_edit", "succeeded", {
    mimeType: image.mimeType,
  });

  // 2. Opus image review (optional)
  let imageReview: RenderReviewOutput | null = null;
  let imageReviewError: string | null = null;
  if (args.briefInput) {
    await emitEdit(args.onStep, "opus_image_review", "started");
    try {
      imageReview = await callOpusImageReview({
        input: args.briefInput,
        imageBase64: image.imageBase64,
        mimeType: image.mimeType,
        tokens,
      });
      await emitEdit(args.onStep, "opus_image_review", "succeeded", {
        verdict: imageReview.overall_match,
      });
    } catch (err) {
      imageReviewError = err instanceof Error ? err.message : String(err);
      await emitEdit(args.onStep, "opus_image_review", "failed", {
        error: imageReviewError,
      });
    }
  }

  return {
    outcome: "rendered",
    finalPrompt: editPrompt,
    image: {
      base64: image.imageBase64,
      mimeType: image.mimeType,
      commentary: image.commentary,
    },
    imageReview,
    imageReviewError,
    tokenUsage: {
      opus_image_in: tokens.opus_image_in,
      opus_image_out: tokens.opus_image_out,
    },
  };
}

async function emitEdit(
  hook: EditStepHook | undefined,
  step: Parameters<EditStepHook>[0]["step"],
  status: Parameters<EditStepHook>[0]["status"],
  detail?: unknown,
): Promise<void> {
  if (!hook) return;
  await hook({ step, status, detail });
}
