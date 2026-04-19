import type Anthropic from "@anthropic-ai/sdk";
import {
  anthropicClient,
  CLAUDE_OPERATOR_MODEL,
  CLAUDE_REVIEWER_MODEL,
} from "@/lib/claude/client";
import {
  buildRenderPromptRequest,
  buildPromptReviewRequest,
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
import type { RoomSpec, PropertyContext, ReferenceMaterial } from "@/lib/specs/schema";

import type {
  GeneratePipelineResult,
  PipelineReference,
  PipelineTokenUsage,
  StepHook,
} from "./types";

export interface RunGeneratePipelineArgs {
  spec: RoomSpec;
  context: PropertyContext;
  basePhoto: { mimeType: string; dataBase64: string };
  basePhotoDescription: string;
  references: PipelineReference[];
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

  const refMaterials = args.references.map((r) => r.material);

  // ---- 1. Sonnet: generate the Gemini render prompt -----------------------
  await emit(args.onStep, "sonnet_prompt", "started");
  const sonnetPrompt = await callSonnetPrompt({
    spec: args.spec,
    context: args.context,
    basePhotoDescription: args.basePhotoDescription,
    references: refMaterials,
    previousIssues: null,
    tokens,
  });
  await emit(args.onStep, "sonnet_prompt", "succeeded");

  // ---- 2. Opus: review Sonnet's prompt ------------------------------------
  await emit(args.onStep, "opus_prompt_review", "started");
  let promptReview = await callOpusPromptReview({
    spec: args.spec,
    context: args.context,
    basePhotoDescription: args.basePhotoDescription,
    references: refMaterials,
    generatedPrompt: sonnetPrompt.prompt,
    tokens,
  });

  let workingPrompt: RenderPromptOutput = sonnetPrompt;
  let sonnetRegenerated = false;

  if (promptReview.verdict === "regenerate") {
    // One retry with Opus's issues fed back into Sonnet.
    const retrySonnet = await callSonnetPrompt({
      spec: args.spec,
      context: args.context,
      basePhotoDescription: args.basePhotoDescription,
      references: refMaterials,
      previousIssues: promptReview.issues,
      tokens,
    });
    sonnetRegenerated = true;
    workingPrompt = retrySonnet;

    const retryReview = await callOpusPromptReview({
      spec: args.spec,
      context: args.context,
      basePhotoDescription: args.basePhotoDescription,
      references: refMaterials,
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
    references: args.references.map((r) => r.image),
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
      spec: args.spec,
      context: args.context,
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
  spec: RoomSpec;
  context: PropertyContext;
  basePhotoDescription: string;
  references: ReferenceMaterial[];
  previousIssues: PromptReviewOutput["issues"] | null;
  tokens: PipelineTokenUsage;
}): Promise<RenderPromptOutput> {
  const { system, user } = buildRenderPromptRequest({
    spec: args.spec,
    context: args.context,
    base_photo_description: args.basePhotoDescription,
    references: args.references.length > 0 ? args.references : undefined,
  });

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
  spec: RoomSpec;
  context: PropertyContext;
  basePhotoDescription: string;
  references: ReferenceMaterial[];
  generatedPrompt: string;
  tokens: PipelineTokenUsage;
}): Promise<PromptReviewOutput> {
  const { system, user } = buildPromptReviewRequest({
    spec: args.spec,
    context: args.context,
    base_photo_description: args.basePhotoDescription,
    generated_prompt: args.generatedPrompt,
    references: args.references.length > 0 ? args.references : undefined,
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
 * Standalone Opus image review — same call as the pipeline's internal step
 * but usable by the /api/renders/[id]/review retrigger endpoint. Returns
 * both the parsed review and the raw token usage so the caller can log it.
 */
export async function runImageReview(args: {
  spec: RoomSpec;
  context: PropertyContext;
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
    spec: args.spec,
    context: args.context,
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
  spec: RoomSpec;
  context: PropertyContext;
  imageBase64: string;
  mimeType: string;
  tokens: PipelineTokenUsage;
}): Promise<RenderReviewOutput> {
  const { system, user } = buildRenderReviewRequest({
    spec: args.spec,
    context: args.context,
  });

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
