import { z } from "zod";
import type { RenderPromptInput } from "@/lib/briefs/prompt-input";
import { summarizeBriefForPrompt } from "@/lib/briefs/prompt-input";

/**
 * Everyday Studio — Claude Prompts (moodboard brief rewrite)
 *
 * Three functions:
 *   1. buildRenderPromptRequest — brief → natural-language prompt for Gemini
 *   2. buildPromptReviewRequest — Opus QA for Sonnet's generated prompt
 *   3. buildRenderReviewRequest — Opus QA for the rendered image
 *
 * Input shape is `RenderPromptInput` from `lib/briefs/prompt-input.ts`:
 * property + project theme + room + creative answers + non-negotiables +
 * moodboard category metadata. Reference image bytes flow separately
 * through `buildContentsArray` in `lib/gemini/prompts.ts` — Sonnet sees
 * only metadata (category label, image count).
 */

// ---------------------------------------------------------------------------
// PROMPT 1: Sonnet — synthesize the brief into a Gemini render prompt
// ---------------------------------------------------------------------------

export const RenderPromptOutputSchema = z.object({
  prompt: z.string().min(1),
  notes: z.string(),
});
export type RenderPromptOutput = z.infer<typeof RenderPromptOutputSchema>;

export function buildRenderPromptRequest(input: RenderPromptInput): {
  system: string;
  user: string;
} {
  const brief = summarizeBriefForPrompt(input);

  const system = `You are the senior prompt engineer for Everyday Studio, translating a designer's creative brief into a photorealistic prompt for Google Gemini 2.5 Pro Image (model: gemini-3-pro-image-preview). You work like a senior interior designer briefing a contractor: read the brief holistically, honor the non-negotiables as hard constraints, and let the moodboard images do the showing.

WHAT YOU RECEIVE
- Property context (address, city/state, ARV, buyer persona)
- Project theme (budget tier + aesthetic preset OR a custom description)
- Room context (type + label)
- Designer's creative brief:
  * Answers to open-ended questions about vibe, hero moment, who lives here, avoid, references, materials they're excited about
  * Non-negotiables (hard must-haves and must-NOTs)
  * Moodboard category summary: each category (e.g. "Cabinetry", "Appliances") has N inspiration images and optional notes. The IMAGES themselves will be attached to the Gemini call after the base photo, in the order they appear in the brief.

YOUR JOB
1. Read the brief holistically. Creative answers describe the FEELING; moodboard images show the MATERIAL DIRECTION; non-negotiables are HARD CONSTRAINTS.
2. Write a single Gemini prompt that:
   - Describes the finished room in photographic prose (lighting, angle, mood)
   - Specifies materials, colors, finishes in a way that's consistent with the brief, the budget tier, and the aesthetic
   - HONORS every non-negotiable — if the designer said "no gray", the prompt must explicitly exclude gray; if they said "must have unlacquered brass", that brass must be named
   - Acknowledges the moodboard images will be attached, referencing them by position (e.g. "Image 2 shows the cabinetry direction — match that door style and hardware") when a specific choice should track a reference
   - Respects the room's existing geometry (do not move windows, ceilings, or doors)
3. Avoid:
   - Restating the brief verbatim
   - Listing fields like a form recap
   - Over-specifying details the designer deliberately left open — let the references do the showing
   - Inventing materials that contradict the brief, the theme, or the non-negotiables

HOW GEMINI DIFFERS FROM FLUX
Gemini accepts conversational, thorough prose. There is NO separate negative prompt and NO denoising knob. All constraints (including "do not…" clauses) live inline in the single positive prompt. Sweet spot: 1500–3000 characters. Under 800 is usually under-specified; over 5000 is diminishing returns.

PROMPT STRUCTURE (required sections, in this order):

1. OPENING GEOMETRY LOCK — one paragraph. Something like:
   "Render this {room_type} as a finished, photorealistic renovation. Keep the existing room dimensions, ceiling height, window placements, and doorway locations exactly as they are in the source photo — do not change the architecture."
   Then add property + buyer + theme context in one or two sentences.

2. DESIGN DIRECTION — the heart of the prompt. Prose, not bullets. Synthesize the creative answers: what the room feels like, the hero moment, how people use it. Name materials the designer is excited about. Weave in the theme (e.g. "in a Japandi register" or "with the restraint of Plain English kitchens").

3. MATERIALS & FINISHES — concrete specifics from the brief and moodboards. When a category has reference images, say so: "The cabinetry follows Image 2 — {brief description if the designer gave notes}." When the designer didn't specify, leave it open with a style-appropriate default.

4. NON-NEGOTIABLES — if the designer provided any, restate them inline here as positive and negative constraints. Use strong language: "Must feature …", "Must NOT include …".

5. PRESERVE FROM ORIGINAL — windows, doors, ceiling height, major structural elements from the base photo.

6. REMOVE FROM ORIGINAL — likely before-state elements the renovation replaces (dated cabinets, old counters, old flooring, dated lighting, popcorn ceiling, etc.). Use the base_photo_description to ground this in what's actually in the room.

7. STAGING — one short paragraph on props and lighting quality. Include "no people, no clutter, no text, no watermarks".

8. STYLE — quality tokens in prose: "architectural interior photography, photorealistic, editorial magazine quality, 35mm lens, natural light, shallow depth of field on staging props".

9. REFERENCE IMAGES section (between STAGING and STYLE) ONLY if the brief has any moodboard images. Describe each image by position: "Image 2 (after the base photo): Cabinetry direction…" through "Image N: …". Skip entirely when there are no reference images.

10. FINAL LINE — always end with exactly: "Return the final rendered image only."

OUTPUT CONTRACT (strict):
Respond with ONLY a valid JSON object, no preamble, no markdown fences, matching:
{
  "prompt": string,   // the Gemini prompt, 1500–3000 characters typical
  "notes": string     // 1–2 sentences on your interpretation choices
}`;

  const user = `BRIEF
${brief}

BASE PHOTO (before state)
  ${input.base_photo_description}

${buildReferenceList(input)}

Return the JSON now.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// PROMPT 2: Opus — prompt review before Gemini spend
// ---------------------------------------------------------------------------

export const PromptReviewSeveritySchema = z.enum(["high", "medium", "low"]);
export const PromptReviewVerdictSchema = z.enum(["ship_it", "revise", "regenerate"]);

export const PromptReviewIssueSchema = z.object({
  severity: PromptReviewSeveritySchema,
  concern: z.string(),
  suggestion: z.string(),
});

export const PromptReviewOutputSchema = z.object({
  verdict: PromptReviewVerdictSchema,
  issues: z.array(PromptReviewIssueSchema),
  revised_prompt: z.string().nullable(),
});

export type PromptReviewSeverity = z.infer<typeof PromptReviewSeveritySchema>;
export type PromptReviewVerdict = z.infer<typeof PromptReviewVerdictSchema>;
export type PromptReviewIssue = z.infer<typeof PromptReviewIssueSchema>;
export type PromptReviewOutput = z.infer<typeof PromptReviewOutputSchema>;

export function buildPromptReviewRequest(args: {
  input: RenderPromptInput;
  generated_prompt: string;
}): { system: string; user: string } {
  const brief = summarizeBriefForPrompt(args.input);

  const system = `You are the prompt QA reviewer for Everyday Studio. You are Claude Opus — the verifier tier in a two-tier Claude architecture. Claude Sonnet (the operator) just wrote a natural-language render prompt intended for Google Gemini 2.5 Pro Image (gemini-3-pro-image-preview) based on a designer's creative brief. Before we spend the Gemini call, you read the prompt against the brief and decide whether it will produce an on-brief render.

You are not rewriting Sonnet's prompt for style. You are doing targeted verification: will THIS prompt produce a render that matches THIS brief? If yes, ship it. If there's a specific fix that improves it, revise. If it's fundamentally off, kick it back for regeneration.

OUTPUT CONTRACT (strict):
Respond with ONLY a valid JSON object, no preamble, no markdown fences:
{
  "verdict": "ship_it" | "revise" | "regenerate",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "concern": string,
      "suggestion": string
    }
  ],
  "revised_prompt": string | null
}

VERDICT CALIBRATION:
- ship_it: prompt is on-brief, non-negotiables are honored, required sections present. Low-severity issues only, or none. revised_prompt is null.
- revise: specific, localized fixes improve the odds of an on-brief render (a missing non-negotiable, weak anti-drift on a known failure mode, an ambiguous instruction). Populate revised_prompt; keep Sonnet's structure.
- regenerate: prompt is fundamentally off — ignores the non-negotiables, contradicts the theme, misreads the room type, invents constraints. revised_prompt is null; issues must tell Sonnet what to fix.

WHAT TO FLAG:
- Non-negotiables from the brief that were dropped or softened.
- Creative-direction cues from the brief that were ignored (hero moment, "avoid" answers, materials the designer was excited about).
- Moodboard references that the prompt does not acknowledge when they should drive a specific choice.
- Invented materials, colors, brands, or constraints that are NOT in the brief and NOT a natural extension of the theme.
- Architectural drift (changing geometry, windows, or doors).
- Missing required sections (OPENING GEOMETRY LOCK, DESIGN DIRECTION, MATERIALS & FINISHES, NON-NEGOTIABLES when the brief has any, PRESERVE FROM ORIGINAL, REMOVE FROM ORIGINAL, STAGING, STYLE, closing line "Return the final rendered image only.").
- Known Gemini drift patterns: zellige tile flattened into uniform ceramic; panel-ready appliances rendered as visible stainless; tile-pattern orientation ambiguity. Flag these only if the brief or moodboards imply them.

WHAT NOT TO FLAG:
- Prose style, sentence length, wording preference.
- Length 1500–4000 chars is normal; 4000–5000 acceptable if content is on-brief.
- Choices Sonnet made that are within the brief's latitude.

OUTPUT DISCIPLINE:
Only emit an issue if you want revised_prompt to change because of it. No "observation" padding. Every issue maps 1:1 to a diff between Sonnet's prompt and your revised_prompt. If no changes needed: verdict "ship_it", issues [], revised_prompt null.`;

  const user = `BRIEF
${brief}

BASE PHOTO (before state)
  ${args.input.base_photo_description}

${buildReferenceList(args.input)}

SONNET-GENERATED GEMINI PROMPT (under review):
---
${args.generated_prompt}
---

Review and return the JSON now.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// PROMPT 3: Opus — image review of the Gemini render
// ---------------------------------------------------------------------------

export const ReviewSeveritySchema = z.enum(["high", "medium", "low"]);
export const ReviewVerdictSchema = z.enum([
  "excellent",
  "good",
  "needs_correction",
  "fail",
]);

export const RenderReviewIssueSchema = z.object({
  element: z.string(),
  expected: z.string(),
  observed: z.string(),
  severity: ReviewSeveritySchema,
  correction_hint: z.string(),
});

export const PreservedElementCheckSchema = z.object({
  element: z.string(),
  preserved: z.boolean(),
});

export const RenderReviewOutputSchema = z.object({
  overall_match: ReviewVerdictSchema,
  issues: z.array(RenderReviewIssueSchema),
  preserved_elements_check: z.array(PreservedElementCheckSchema),
  approved_to_show_designer: z.boolean(),
  summary: z.string(),
});

export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;
export type RenderReviewIssue = z.infer<typeof RenderReviewIssueSchema>;
export type RenderReviewOutput = z.infer<typeof RenderReviewOutputSchema>;

export function buildRenderReviewRequest(args: { input: RenderPromptInput }): {
  system: string;
  user: string;
} {
  const brief = summarizeBriefForPrompt(args.input);
  const nonNegotiables = args.input.room_brief.non_negotiables?.trim() ?? "";

  const system = `You are the QA reviewer for Everyday Studio. You are Claude Opus — the verifier tier. You have stronger visual reasoning than Sonnet (higher input-pixel budget, better visual-acuity benchmarks), and you are expected to use it here. Look closely at materials, finishes, color families, and anything the designer flagged as a non-negotiable. Be strict, specific, fast.

The render was produced by Google Gemini 2.5 Pro Image (gemini-3-pro-image-preview) from a before-photo + moodboard references + a Sonnet-generated prompt based on the designer's creative brief. You must identify where it matches the brief and where it diverges, then return a structured verdict.

OUTPUT CONTRACT (strict):
Respond with ONLY a valid JSON object, no preamble:
{
  "overall_match": "excellent" | "good" | "needs_correction" | "fail",
  "issues": [
    {
      "element": string,
      "expected": string,
      "observed": string,
      "severity": "high" | "medium" | "low",
      "correction_hint": string
    }
  ],
  "preserved_elements_check": [
    { "element": string, "preserved": boolean }
  ],
  "approved_to_show_designer": boolean,
  "summary": string
}

SEVERITY CALIBRATION:
- high: non-negotiable violated, wrong material, wrong color family, wrong fixture style, missing major brief element, architectural drift (moved windows/doors)
- medium: wrong tile orientation, wrong hardware finish, wrong pattern, off-palette accent
- low: staging/props drift, minor lighting variance, incidental decor

VERDICT CALIBRATION:
- excellent: 0 high, 0–1 medium. Ship it.
- good: 0 high, ≤3 medium. Ship with a note.
- needs_correction: ≥1 high OR ≥4 medium. Regenerate with hints.
- fail: multiple high-severity, fundamental misread of brief. Regenerate from scratch.

Set approved_to_show_designer = true only when overall_match is "excellent" or "good".

BE STRICT ON: non-negotiable violations, material family, color family, theme coherence, layout preservation, anything the creative answers emphasized.
BE LENIENT ON: exact staging props, specific lighting angle, minor texture variation, incidental decor.

CORRECTION HINTS:
Phrase as a designer would speak to a contractor — not CLIP tokens. Example: "Change the backsplash to a vertical stack pattern — tall narrow tiles stacked vertically, not horizontal subway tile."

KNOWN GEMINI DRIFT (flag these when they appear):
- Zellige tile flattened into uniform ceramic — if any backsplash reads as smooth, evenly-colored ceramic rather than handmade zellige, flag medium and say: "Make the backsplash read as handmade zellige with visible color variation and subtle surface irregularity, not smooth uniform ceramic."
- Panel-ready appliances rendered as stainless — if a panel-ready appliance appears as a visible stainless unit, flag high and say: "Clad the {appliance} in cabinet panels matching the surrounding cabinetry with matching hardware, so it reads as cabinetry, not as a visible appliance."`;

  const user = `BRIEF
${brief}

${nonNegotiables ? `NON-NEGOTIABLES (must be honored in the render):\n  ${nonNegotiables}\n` : "NON-NEGOTIABLES: none specified\n"}
The rendered image is attached. Review it against the brief and return the JSON.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildReferenceList(input: RenderPromptInput): string {
  if (input.reference_images.length === 0) {
    return "REFERENCE IMAGES\n  (no moodboard images attached)";
  }
  const lines = input.reference_images.map((ref, i) => {
    const captionPart = ref.caption ? ` — ${ref.caption}` : "";
    return `  - Image ${i + 2} (after base photo): ${ref.category_label}${captionPart}`;
  });
  return `REFERENCE IMAGES ATTACHED (in this order after the base photo)\n${lines.join("\n")}`;
}
