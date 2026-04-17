import type { RoomSpec, PropertyContext } from "../specs/schema";
import { deriveBudgetTier } from "../specs/schema";

/**
 * Everyday Studio — Production Claude Prompts
 *
 * Two functions that matter most:
 *   1. buildRenderPromptRequest — spec → natural-language prompt for Gemini
 *   2. buildRenderReviewRequest — render output → QA against spec
 *
 * Both return { system, user } objects ready to pass to the Anthropic SDK.
 * Both enforce JSON output via response_format + example in prompt.
 */

import type { ReferenceMaterial } from "../specs/schema";

// ---------------------------------------------------------------------------
// Shared: summarize a spec into a dense, prompt-ready brief
// ---------------------------------------------------------------------------

function summarizeSpecForPrompt(spec: RoomSpec): string {
  // We deliberately hand-write this rather than JSON.stringify — LLMs
  // generate noticeably better renders from natural-language specs than
  // from raw JSON, and we can emphasize the spec elements that matter
  // most visually.
  const parts: string[] = [];

  parts.push(`Room: ${spec.room_name} (${spec.room_type})`);
  parts.push(`Dimensions: ${spec.dimensions}, ${spec.ceiling_height} ceilings`);
  if (spec.existing_to_keep.length > 0) {
    parts.push(`Preserve existing: ${spec.existing_to_keep.join(", ")}`);
  }

  parts.push(
    `Walls painted ${spec.paint.walls.color_name} (${spec.paint.walls.color_code ?? "custom"}) in ${spec.paint.walls.sheen}`,
  );
  if (spec.paint.accent_wall) {
    parts.push(
      `Accent wall (${spec.paint.accent_wall_location}): ${spec.paint.accent_wall.color_name}`,
    );
  }

  parts.push(
    `Flooring: ${spec.flooring.color_tone.replace(/_/g, " ")} ${spec.flooring.material.replace(/_/g, " ")}, ${spec.flooring.plank_or_tile_size}, ${spec.flooring.pattern !== "none" ? spec.flooring.pattern : "standard"} pattern`,
  );

  // Lighting: describe the top 2 fixtures in natural language
  const headlineFixtures = spec.lighting.fixtures.slice(0, 3).map((f) => {
    const loc = f.location_notes ? ` ${f.location_notes}` : "";
    return `${f.quantity}x ${f.finish.replace(/_/g, " ")} ${f.fixture_type.replace(/_/g, " ")}${loc}`;
  });
  parts.push(`Lighting: ${headlineFixtures.join("; ")}`);
  parts.push(`Natural light: ${spec.lighting.natural_light_quality.replace(/_/g, " ")}`);

  // Room-type specific sections
  if (spec.room_type === "kitchen") {
    parts.push(
      `Cabinets: ${spec.cabinetry.style} style, ${spec.cabinetry.door_overlay.replace(/_/g, " ")}, painted ${spec.cabinetry.color.color_name}${spec.cabinetry.upper_cabinets_to_ceiling ? ", uppers run to ceiling" : ""}`,
    );
    parts.push(
      `Cabinet hardware: ${spec.cabinetry.hardware.finish.replace(/_/g, " ")} ${spec.cabinetry.hardware.type}${spec.cabinetry.hardware.size ? ` (${spec.cabinetry.hardware.size})` : ""}`,
    );
    if (spec.cabinetry.island.present) {
      parts.push(
        `Island: ${spec.cabinetry.island.size}, painted ${spec.cabinetry.island.color.color_name}, seats ${spec.cabinetry.island.seating}`,
      );
    }
    parts.push(
      `Counters: ${spec.counters.material}${spec.counters.pattern_name ? ` (${spec.counters.pattern_name} pattern)` : ""}, ${spec.counters.thickness}, ${spec.counters.edge_profile} edge${spec.counters.waterfall_sides > 0 ? `, ${spec.counters.waterfall_sides}-side waterfall` : ""}`,
    );
    if (spec.backsplash.material !== "none") {
      parts.push(
        `Backsplash: ${spec.backsplash.material.replace(/_/g, " ")}, ${spec.backsplash.tile_size}, ${spec.backsplash.pattern.replace(/_/g, " ")} pattern, ${spec.backsplash.extent.replace(/_/g, " ")}, ${spec.backsplash.grout_color.replace(/_/g, " ")} grout`,
      );
    }
    const applianceNames = spec.appliances
      .map((a) => `${a.finish.replace(/_/g, " ")} ${a.type.replace(/_/g, " ")}`)
      .join(", ");
    if (applianceNames) parts.push(`Appliances: ${applianceNames}`);
    const plumbingNames = spec.plumbing
      .map(
        (p) =>
          `${p.finish.replace(/_/g, " ")} ${p.fixture_type.replace(/_/g, " ")}${p.style_notes ? ` (${p.style_notes})` : ""}`,
      )
      .join(", ");
    if (plumbingNames) parts.push(`Plumbing: ${plumbingNames}`);
  }

  if (
    spec.room_type === "primary_bath" ||
    spec.room_type === "secondary_bath" ||
    spec.room_type === "powder"
  ) {
    if (spec.vanity) {
      parts.push(
        `Vanity: ${spec.vanity.width} ${spec.vanity.single_or_double}, ${spec.vanity.style} style, painted ${spec.vanity.color.color_name}, ${spec.vanity.top_material} top, ${spec.vanity.hardware_finish.replace(/_/g, " ")} hardware`,
      );
    }
    parts.push(`Shower/tub: ${spec.shower_type.replace(/_/g, " ")}`);
    spec.tile_surfaces.forEach((t) => {
      parts.push(
        `${t.location.replace(/_/g, " ")}: ${t.material.replace(/_/g, " ")} tile, ${t.tile_size}, ${t.pattern.replace(/_/g, " ")} pattern, ${t.grout_color.replace(/_/g, " ")} grout`,
      );
    });
    const plumbingNames = spec.plumbing
      .map(
        (p) =>
          `${p.finish.replace(/_/g, " ")} ${p.fixture_type.replace(/_/g, " ")}${p.style_notes ? ` (${p.style_notes})` : ""}`,
      )
      .join(", ");
    if (plumbingNames) parts.push(`Plumbing: ${plumbingNames}`);
  }

  if (spec.room_type === "primary_bedroom" || spec.room_type === "secondary_bedroom") {
    if (spec.ceiling_fan) parts.push("Ceiling fan installed");
    if (spec.closet_notes) parts.push(`Closet: ${spec.closet_notes}`);
  }

  if (
    ["living_room", "family_room", "dining_room", "foyer", "hallway", "laundry", "office"].includes(
      spec.room_type,
    )
  ) {
    if ("fireplace" in spec && spec.fireplace && spec.fireplace.present) {
      parts.push(
        `Fireplace: ${spec.fireplace.surround_material} surround${spec.fireplace.mantel_notes ? `, ${spec.fireplace.mantel_notes}` : ""}`,
      );
    }
    if ("built_ins" in spec && spec.built_ins) parts.push("Built-in cabinetry");
  }

  if (spec.layout_notes) parts.push(`Layout notes: ${spec.layout_notes}`);

  return parts.map((p) => `  - ${p}`).join("\n");
}

// ---------------------------------------------------------------------------
// PROMPT 1: Render prompt generation (Gemini natural-language format)
// ---------------------------------------------------------------------------

export interface RenderPromptOutput {
  prompt: string; // natural-language prompt for Gemini, 2000–4000 chars typical
  notes: string; // 1–2 sentence explanation of emphasis choices
}

export function buildRenderPromptRequest(args: {
  spec: RoomSpec;
  context: PropertyContext;
  base_photo_description: string; // what the before photo shows
  references?: ReferenceMaterial[]; // optional designer-attached material refs
}): { system: string; user: string } {
  const tier = deriveBudgetTier(args.context);
  const specBrief = summarizeSpecForPrompt(args.spec);
  const references = args.references ?? [];

  const system = `You are the senior prompt engineer for Everyday Studio, an interior design rendering pipeline for residential fix-and-flip properties. You translate locked room specifications into photorealistic prompts for Google Gemini 2.5 Pro Image (model: gemini-3-pro-image-preview).

Your prompts drive renders that must be TRUE to the spec — a designer's client and a contractor will both rely on these images. Invented materials are a failure. Drift from the spec is a failure. Beautiful but wrong is a failure.

OUTPUT CONTRACT (strict):
You must respond with ONLY a valid JSON object, no preamble, no markdown fences, matching this exact shape:
{
  "prompt": string,   // natural-language prompt for Gemini, 2000–4000 characters typical
  "notes": string     // 1–2 sentences on what you emphasized or made choices about
}

HOW GEMINI DIFFERS FROM FLUX (important):
Gemini accepts — and performs better with — conversational, thorough prose. There is NO separate negative prompt and NO denoising-strength knob. All constraints (including things the model must NOT do) live inline in the single positive prompt as "do not…" or "not X" clauses. Write like a designer briefing a contractor: complete sentences, specific brands and color codes, explicit teardown of the before-state. Length discipline is inverted vs. CLIP: 2000–4000 characters is the sweet spot; under 1000 is usually under-specified; over 6000 is diminishing returns.

PROMPT STRUCTURE (required sections, in this order):

1. OPENING GEOMETRY LOCK — one paragraph. Start with (adjust room type as appropriate):
   "Render this kitchen as a finished, photorealistic renovation. Keep the existing room dimensions, ceiling height, window placements, and doorway locations exactly as they are in the source photo — do not change the architecture."
   Then add property context in one or two sentences (address, buyer persona, style direction).

2. DESIGN SPECIFICATION: — materials grouped by category, in visual-prominence order for that room type. For a kitchen: Cabinets → Hardware → Counters → Backsplash → Island → Appliances → Plumbing → Lighting → Flooring → Walls → Trim and ceiling. Name brands and color codes explicitly (e.g., "Alabaster SW 7008", "Cambria Brittanicca Warm", "Clé Zellige 3x12 Weathered White"). Describe textures and finishes ("unlacquered raw warm-golden tone, not chrome, not polished brass"). Emphasize negative constraints inline where drift is common (e.g., "Install the zellige in a VERTICAL STACK pattern — tall narrow tiles stacked vertically, not horizontal subway tile").

3. PRESERVE FROM ORIGINAL: — a bulleted or short-list rendering of the spec's existing_to_keep items. If empty, write "(none specified — standard preservation of walls, windows, and doorways still applies)".

4. REMOVE FROM ORIGINAL: — explicit teardown of likely before-state elements the renovation replaces (old cabinets, old counters, old backsplash, old flooring, dated lighting, popcorn ceiling, dated paint). Use the base_photo_description to ground this list in what's actually in the room.

5. STAGING: — one short paragraph on props and lighting quality from the spec (morning light, staging items like a cutting board and herb pot, mostly clear counters). Include "no people, no clutter, no text, no watermarks".

6. STYLE: — close with quality tokens in prose: "architectural interior photography, photorealistic, editorial magazine quality, 35mm lens, natural light, shallow depth of field on staging props".

7. If REFERENCE IMAGES are listed in the user message, add a REFERENCE IMAGES: section (between STAGING and STYLE) describing what each reference shows and how Gemini should use it (e.g., "Image 2 (after base photo): zellige tile sample — match this handmade color variation and warm off-white tone"). If no references are listed, omit this section entirely.

8. FINAL LINE — always end with exactly: "Return the final rendered image only."

WRITING RULES:
- Name every key material from the spec. Do not invent materials, colors, fixtures, or finishes not in the spec.
- Do not describe changes to room geometry, window placement, or door locations.
- Prefer specific brand + color code over generic descriptors.
- Call out the most-likely-to-drift details twice in different words (e.g., backsplash pattern orientation).
- No markdown, no bullet lists inside the prompt beyond the section headers above — Gemini does best with prose sections.`;

  const refLines =
    references.length > 0
      ? references
          .map((r, i) => {
            const typePart = r.material_type ? ` [${r.material_type}]` : "";
            return `  - Image ${i + 2} (after base photo): "${r.label}"${typePart}`;
          })
          .join("\n")
      : "(no references attached)";

  const user = `PROPERTY CONTEXT
  Address: ${args.context.address}
  ARV: $${args.context.arv.toLocaleString()}
  Rehab budget: $${args.context.rehab_budget.toLocaleString()}
  Budget tier: ${tier}
  Target buyer: ${args.context.buyer_persona.replace(/_/g, " ")}
  Neighborhood: ${args.context.neighborhood_notes ?? "n/a"}
  Style direction: ${args.context.style_direction ?? "derive from spec"}

BASE PHOTO (before state)
  ${args.base_photo_description}

LOCKED ROOM SPEC
${specBrief}

REFERENCE IMAGES ATTACHED BY DESIGNER
${refLines}

Return the JSON now.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// PROMPT 2: Prompt QA review (Opus reviews Sonnet's Gemini prompt before send)
// ---------------------------------------------------------------------------
//
// Model: Opus (CLAUDE_REVIEWER_MODEL). This is the pre-render gate. Sonnet
// generated the Gemini prompt as the operator; Opus reads the prompt plus
// the locked spec and decides whether to ship it, revise it, or bounce it
// back to Sonnet for a regenerate. The intent of the pattern is a closed
// loop: generator → reviewer → renderer → reviewer.
//
// This extra step is a bet that Opus catches prompt-level problems (weak
// anti-drift language, missing spec elements, excessive verbosity) often
// enough to pay for itself. Validate empirically on 5–10 real renders
// after Session 2.5 — if Opus rubber-stamps Sonnet >90% of the time, delete
// this step. If it intervenes ≥20% of the time, keep it.

export type PromptReviewSeverity = "high" | "medium" | "low";
export type PromptReviewVerdict = "ship_it" | "revise" | "regenerate";

export interface PromptReviewIssue {
  severity: PromptReviewSeverity;
  concern: string; // what's wrong with the prompt
  suggestion: string; // specific fix
}

export interface PromptReviewOutput {
  verdict: PromptReviewVerdict;
  issues: PromptReviewIssue[];
  revised_prompt: string | null; // populated when verdict === "revise"
}

export function buildPromptReviewRequest(args: {
  spec: RoomSpec;
  context: PropertyContext;
  generated_prompt: string; // the Sonnet-generated Gemini prompt
  base_photo_description: string;
  references?: ReferenceMaterial[];
}): { system: string; user: string } {
  const tier = deriveBudgetTier(args.context);
  const specBrief = summarizeSpecForPrompt(args.spec);
  const references = args.references ?? [];

  const system = `You are the prompt QA reviewer for Everyday Studio. You are Claude Opus — the verifier tier in a two-tier Claude architecture. Claude Sonnet (the operator) just wrote a natural-language render prompt intended for Google Gemini 2.5 Pro Image (gemini-3-pro-image-preview). Before we spend the Gemini call, you read the prompt against the locked spec and decide whether it will produce an on-spec render.

You are not rewriting Sonnet's prompt for style. You are doing targeted verification: will THIS prompt produce a render that matches THIS spec? If yes, ship it. If there's a specific fix that improves it, revise. If it's fundamentally off, kick it back for regeneration.

OUTPUT CONTRACT (strict):
Respond with ONLY a valid JSON object, no preamble, no markdown fences, matching this exact shape:
{
  "verdict": "ship_it" | "revise" | "regenerate",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "concern": string,       // what's wrong with the prompt
      "suggestion": string     // specific fix the render prompt needs
    }
  ],
  "revised_prompt": string | null
}

VERDICT CALIBRATION:
- ship_it: prompt is on-spec and all required sections (geometry lock, DESIGN SPECIFICATION, PRESERVE FROM ORIGINAL, REMOVE FROM ORIGINAL, STAGING, STYLE, close line) are present. Low-severity issues only, or none. Revised_prompt is null.
- revise: there are specific, localized fixes that would measurably improve the odds of an on-spec render (stronger anti-drift language on a known drift element, a missing spec callout, an ambiguous instruction). Populate revised_prompt with your improved version. Keep Sonnet's overall structure and length; make targeted edits.
- regenerate: the prompt is fundamentally off — wrong room type, invented materials, missing most spec elements, violates the required structure. Revised_prompt is null; issues must explain what Sonnet needs to fix when it regenerates.

WHAT TO FLAG:
- Weak anti-drift language on known Gemini failure modes: zellige handmade character (must read as handmade with color variation, not uniform machine-made ceramic); panel-ready appliances (must be clad in cabinet panels, not visible stainless); horizontal-vs-vertical tile pattern ambiguity.
- Missing spec elements (cabinet color, hardware finish, counter material, backsplash pattern, flooring, lighting, paint, preserved elements).
- Invented materials, colors, brands, or fixtures that are not in the spec.
- Architectural drift: prompt describes changing geometry, window placement, or doorways that should be preserved.
- Excessive verbosity that dilutes key tokens (if the prompt exceeds 5000 chars, flag low-severity unless the extra content is on-spec detail).
- Missing required section headers (PRESERVE FROM ORIGINAL, REMOVE FROM ORIGINAL, STAGING, STYLE) or missing close line "Return the final rendered image only."

WHAT NOT TO FLAG:
- Prose style, sentence length, or wording preference.
- Length for its own sake — prompts in the 2000–4000 char range are normal; 4000–6000 is acceptable if the content is on-spec.
- Choices Sonnet made that are within the spec's latitude (e.g., which two materials to mention in the STAGING section).

If you revise, make only the changes that matter for render accuracy. Preserve Sonnet's structure and voice. Do not rewrite the prompt end-to-end unless the verdict is regenerate (in which case you return null).`;

  const refLines =
    references.length > 0
      ? references
          .map((r, i) => {
            const typePart = r.material_type ? ` [${r.material_type}]` : "";
            return `  - Image ${i + 2} (after base photo): "${r.label}"${typePart}`;
          })
          .join("\n")
      : "(no references attached)";

  const user = `PROPERTY CONTEXT
  Address: ${args.context.address}
  ARV: $${args.context.arv.toLocaleString()}
  Rehab budget: $${args.context.rehab_budget.toLocaleString()}
  Budget tier: ${tier}
  Target buyer: ${args.context.buyer_persona.replace(/_/g, " ")}
  Neighborhood: ${args.context.neighborhood_notes ?? "n/a"}
  Style direction: ${args.context.style_direction ?? "derive from spec"}

BASE PHOTO (before state)
  ${args.base_photo_description}

LOCKED ROOM SPEC
${specBrief}

REFERENCE IMAGES ATTACHED BY DESIGNER
${refLines}

SONNET-GENERATED GEMINI PROMPT (under review):
---
${args.generated_prompt}
---

Review the prompt against the spec and return the JSON now.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// PROMPT 3: Render QA review (Opus reviews the Gemini-rendered image)
// ---------------------------------------------------------------------------
//
// Model: Opus (CLAUDE_REVIEWER_MODEL). Opus has meaningfully stronger vision
// than Sonnet (per release notes: ~3x the input pixels, 98.5% vs 54.5% on
// visual-acuity benchmarks), which is exactly why we pay for it here:
// catching "backsplash is horizontal not vertical" drift on a real image is
// the job Opus was tuned for.

export type ReviewSeverity = "high" | "medium" | "low";
export type ReviewVerdict = "excellent" | "good" | "needs_correction" | "fail";

export interface RenderReviewIssue {
  element: string; // "backsplash"
  expected: string; // "3x12 zellige, vertical stack"
  observed: string; // "subway tile, horizontal"
  severity: ReviewSeverity;
  correction_hint: string; // what to add to the re-render prompt
}

export interface RenderReviewOutput {
  overall_match: ReviewVerdict;
  issues: RenderReviewIssue[];
  preserved_elements_check: {
    element: string;
    preserved: boolean;
  }[];
  approved_to_show_designer: boolean;
  summary: string; // 1-sentence human-readable summary
}

export function buildRenderReviewRequest(args: {
  spec: RoomSpec;
  context: PropertyContext;
}): { system: string; user: string } {
  const specBrief = summarizeSpecForPrompt(args.spec);

  const system = `You are the QA reviewer for Everyday Studio. You are Claude Opus — the verifier tier in a two-tier Claude architecture. You have stronger visual reasoning than Sonnet (higher input-pixel budget, meaningfully better visual-acuity benchmarks), and you are expected to use that capacity here. Look closely at tile orientation, grout lines, hardware finish, cabinet panel seams, and any subtle material cue that distinguishes on-spec from off-spec. Be strict, specific, and fast.

The render was produced by Google Gemini 2.5 Pro Image (model: gemini-3-pro-image-preview) from a before-photo plus a Sonnet-generated natural-language prompt. It will be provided as an image. You must identify where it matches the spec and where it diverges, then return a structured verdict that the Mockup Studio can act on.

OUTPUT CONTRACT (strict):
Respond with ONLY a valid JSON object, no preamble, matching this shape:
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
- high: wrong material, wrong color family, wrong fixture style, missing spec element, geometry drift, extra windows/doors
- medium: wrong pattern orientation, wrong finish on hardware, wrong tile size, wrong cabinet style detail
- low: staging/props drift, minor lighting variance, texture detail variance

VERDICT CALIBRATION:
- excellent: 0 high, 0–1 medium issues. Ship it.
- good: 0 high, ≤3 medium. Ship with a note.
- needs_correction: ≥1 high OR ≥4 medium. Regenerate with hints.
- fail: multiple high severity issues, fundamental misread of spec. Regenerate from scratch with stronger prompt.

Set approved_to_show_designer = true only when overall_match is "excellent" or "good".

BE STRICT ON: material accuracy, color family accuracy, layout preservation, fixture style, preserved existing elements.
BE LENIENT ON: exact staging props, specific lighting angle, minor texture variation, incidental decor.

CORRECTION HINTS:
Each hint should be a short, conversational instruction that would fix the specific issue if passed to Gemini as a follow-up edit. Phrase it as a designer would speak to a contractor — not as CLIP-style tokens. Example: "Change the backsplash to a vertical stack pattern — tall narrow tiles stacked vertically, not horizontal subway tile."

KNOWN GEMINI DRIFT (still flag, do not let it slide):
- Zellige handmade color variation tends to get flattened into uniform machine-made ceramic. If the backsplash reads as smooth, evenly-colored ceramic rather than handmade zellige, flag it as a medium issue and phrase the correction hint as: "Make the backsplash read as handmade zellige with visible color variation and subtle surface irregularity, warm off-white, not smooth uniform ceramic."
- Panel-ready appliances (fridge, dishwasher) often render as visible stainless steel instead of being clad in matching cabinet panels. If any panel-ready appliance is visible as a stainless unit, flag it as a high issue and phrase the correction hint as: "Clad the [appliance] in cabinet panels matching the surrounding cabinetry with matching hardware, so it reads as cabinetry, not as a visible appliance."`;

  const user = `LOCKED ROOM SPEC
${specBrief}

PRESERVED ELEMENTS (must not change from base photo):
${args.spec.existing_to_keep.length > 0 ? args.spec.existing_to_keep.map((e) => `  - ${e}`).join("\n") : "  (none specified)"}

BUYER CONTEXT: ${args.context.buyer_persona.replace(/_/g, " ")} | Budget tier: ${deriveBudgetTier(args.context)}

The rendered image is attached. Review it against the spec and return the JSON.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Typed Anthropic call helpers (optional — for reference in the Next.js app)
// ---------------------------------------------------------------------------

/**
 * Example routing in /app/api/render/generate/route.ts:
 *
 * import { anthropicClient, CLAUDE_OPERATOR_MODEL, CLAUDE_REVIEWER_MODEL } from "@/lib/claude/client";
 * import {
 *   buildRenderPromptRequest,
 *   buildPromptReviewRequest,
 *   buildRenderReviewRequest,
 * } from "@/lib/claude/prompts";
 *
 * // 1. Sonnet generates the Gemini prompt.
 * const gen = buildRenderPromptRequest({ spec, context, base_photo_description, references });
 * const genResp = await anthropicClient.messages.create({
 *   model: CLAUDE_OPERATOR_MODEL,
 *   max_tokens: 4096,
 *   system: gen.system,
 *   messages: [{ role: "user", content: gen.user }],
 * });
 * const promptOutput: RenderPromptOutput = JSON.parse(extractText(genResp));
 *
 * // 2. Opus reviews Sonnet's prompt before we spend the Gemini call.
 * const rev = buildPromptReviewRequest({ spec, context, base_photo_description, references, generated_prompt: promptOutput.prompt });
 * const revResp = await anthropicClient.messages.create({
 *   model: CLAUDE_REVIEWER_MODEL,
 *   max_tokens: 4096,
 *   system: rev.system,
 *   messages: [{ role: "user", content: rev.user }],
 * });
 * const promptReview: PromptReviewOutput = JSON.parse(extractText(revResp));
 *
 * const finalPrompt =
 *   promptReview.verdict === "revise" && promptReview.revised_prompt
 *     ? promptReview.revised_prompt
 *     : promptOutput.prompt;
 *
 * // (if verdict === "regenerate", loop back to step 1 with promptReview.issues as feedback.)
 *
 * // 3. Gemini renders.
 * // ... see lib/gemini/client.ts ...
 *
 * // 4. Opus reviews the rendered image.
 * const qa = buildRenderReviewRequest({ spec, context });
 * const qaResp = await anthropicClient.messages.create({
 *   model: CLAUDE_REVIEWER_MODEL,
 *   max_tokens: 2048,
 *   system: qa.system,
 *   messages: [
 *     {
 *       role: "user",
 *       content: [
 *         { type: "image", source: { type: "base64", media_type: "image/png", data: renderBase64 } },
 *         { type: "text", text: qa.user },
 *       ],
 *     },
 *   ],
 * });
 * const qaReview: RenderReviewOutput = JSON.parse(extractText(qaResp));
 */
