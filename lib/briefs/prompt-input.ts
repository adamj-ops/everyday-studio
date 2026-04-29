import { questionsForSpace } from "./questions";
import { categoriesForSpace } from "./categories";
import type { ProjectTheme, SpaceBrief, SurfaceType } from "./schema";
import { budgetTierLabel, themePresetLabel } from "./themes";
import { spaceTypeLabel } from "./space-types";

export interface PromptInputProperty {
  address: string;
  city_state: string;
  arv_estimate: number | null;
  buyer_persona: string | null;
}

export interface PromptInputSpace {
  space_type: string;
  label: string;
}

export interface PromptInputReferenceImage {
  storage_path: string;
  category_label: string;
  caption: string | null;
}

export interface PromptInputCategorySummary {
  category_key: string;
  category_label: string;
  image_count: number;
  notes: string | null;
}

/**
 * Full input shape the Claude operator consumes. Image bytes are not in
 * here — Sonnet only sees metadata; bytes flow through
 * `lib/gemini/prompts.ts#buildContentsArray` in the same order as
 * `reference_images`.
 */
export interface RenderPromptInput {
  surface_type: SurfaceType;
  property: PromptInputProperty;
  project_theme: ProjectTheme | null;
  space: PromptInputSpace;
  space_brief: {
    creative_answers: Record<string, string>;
    non_negotiables: string | null;
    category_moodboards: PromptInputCategorySummary[];
  };
  base_photo_description: string;
  reference_images: PromptInputReferenceImage[];
}

/**
 * Build the prompt input from Supabase rows + resolved brief + theme.
 * `reference_images` order drives Gemini's multi-image content array order;
 * callers must download bytes in the same order (see `/api/render/generate`).
 */
export function buildRenderPromptInput(args: {
  property: PromptInputProperty;
  project_theme: ProjectTheme | null;
  space: PromptInputSpace;
  brief: SpaceBrief;
  base_photo_description: string;
}): RenderPromptInput {
  const { brief, space } = args;

  const categorySummaries: PromptInputCategorySummary[] = brief.category_moodboards.map((cm) => ({
    category_key: cm.category_key,
    category_label: cm.category_label,
    image_count: cm.image_storage_paths.length,
    notes: cm.notes,
  }));

  const referenceImages: PromptInputReferenceImage[] = brief.category_moodboards.flatMap((cm) =>
    cm.image_storage_paths.map((path) => ({
      storage_path: path,
      category_label: cm.category_label,
      caption: cm.notes,
    })),
  );

  return {
    surface_type: brief.surface_type,
    property: args.property,
    project_theme: args.project_theme,
    space,
    space_brief: {
      creative_answers: brief.creative_answers,
      non_negotiables: brief.non_negotiables,
      category_moodboards: categorySummaries,
    },
    base_photo_description: args.base_photo_description,
    reference_images: referenceImages,
  };
}

/**
 * Flatten a `SpaceBrief.category_moodboards` into ordered storage paths so
 * the route that downloads bytes can keep the same order as
 * `input.reference_images`.
 */
export function flattenMoodboardPaths(brief: SpaceBrief): string[] {
  return brief.category_moodboards.flatMap((cm) => cm.image_storage_paths);
}

/**
 * Natural-language summary of the brief for Sonnet / Opus system prompts.
 * Deliberately hand-written so LLMs consume prose, not JSON.
 */
export function summarizeBriefForPrompt(input: RenderPromptInput): string {
  const parts: string[] = [];

  parts.push(`Property: ${input.property.address} — ${input.property.city_state}`);
  if (input.property.arv_estimate != null) {
    parts.push(`ARV: $${input.property.arv_estimate.toLocaleString()}`);
  }
  if (input.property.buyer_persona) {
    parts.push(`Target buyer: ${input.property.buyer_persona.replace(/_/g, " ")}`);
  }

  const theme = input.project_theme;
  if (theme) {
    parts.push(`Budget tier: ${budgetTierLabel(theme.budget_tier)}`);
    if (theme.budget_tier === "custom" && theme.budget_custom_notes) {
      parts.push(`  Budget notes: ${theme.budget_custom_notes.trim()}`);
    }
    if (theme.theme_preset) {
      parts.push(`Aesthetic: ${themePresetLabel(theme.theme_preset)}`);
      if (theme.theme_preset === "custom" && theme.theme_custom_description) {
        parts.push(`  Theme description: ${theme.theme_custom_description.trim()}`);
      }
    } else {
      parts.push("Aesthetic: no preset — derive from brief");
    }
  } else {
    parts.push("Project theme: not set — derive budget and aesthetic from the brief");
  }

  parts.push(`Surface type: ${input.surface_type.replace(/_/g, " ")}`);
  parts.push(`Space: ${spaceTypeLabel(input.space.space_type)} — "${input.space.label}"`);

  const questions = questionsForSpace(input.space.space_type);
  const answered: string[] = [];
  for (const q of questions) {
    const raw = input.space_brief.creative_answers[q.key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      answered.push(`  Q: ${q.prompt}\n  A: ${raw.trim()}`);
    }
  }
  if (answered.length > 0) {
    parts.push("Creative direction:");
    parts.push(answered.join("\n"));
  } else {
    parts.push("Creative direction: (designer left blank — lean on moodboards and theme)");
  }

  const nonNegotiables = input.space_brief.non_negotiables?.trim();
  if (nonNegotiables) {
    parts.push(`Non-negotiables (HARD CONSTRAINTS): ${nonNegotiables}`);
  }

  const categories = categoriesForSpace(input.space.space_type);
  const moodboardLines: string[] = [];
  for (const cat of categories) {
    const summary = input.space_brief.category_moodboards.find(
      (cm) => cm.category_key === cat.key,
    );
    const count = summary?.image_count ?? 0;
    const notes = summary?.notes?.trim() ?? "";
    if (count === 0 && !notes) continue;
    const notePart = notes ? ` — notes: ${notes}` : "";
    moodboardLines.push(`  - ${cat.label}: ${count} image${count === 1 ? "" : "s"}${notePart}`);
  }
  if (moodboardLines.length > 0) {
    parts.push("Moodboard (inspiration images will be attached as references):");
    parts.push(moodboardLines.join("\n"));
  } else if (input.space_brief.category_moodboards.length > 0) {
    parts.push("Moodboard (inspiration images will be attached as references):");
    parts.push(
      input.space_brief.category_moodboards
        .map((cm) => {
          const notes = cm.notes?.trim() ? ` — notes: ${cm.notes.trim()}` : "";
          return `  - ${cm.category_label}: ${cm.image_count} image${cm.image_count === 1 ? "" : "s"}${notes}`;
        })
        .join("\n"),
    );
  } else {
    parts.push("Moodboard: (empty)");
  }

  return parts.join("\n");
}
