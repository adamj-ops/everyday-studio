import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProjectThemeSchema,
  SpaceBriefSchema,
  type ProjectTheme,
  type SpaceBrief,
} from "./schema";
import { buildRenderPromptInput, type RenderPromptInput } from "./prompt-input";

export type LoadPromptInputResult =
  | { ok: true; input: RenderPromptInput; brief_id: string }
  | { ok: false; error: "space_not_found" | "property_not_found" | "no_brief_for_space" | "brief_invalid" };

/**
 * Loads the latest space brief, the property theme (if any), and the property
 * row, then builds a `RenderPromptInput` ready for Sonnet.
 *
 * Runs under the caller's Supabase client (so RLS applies). Returns a
 * discriminated result so API routes can map to precise HTTP errors.
 */
export async function loadPromptInput(args: {
  supabase: SupabaseClient;
  spaceId: string;
  basePhotoDescription: string;
}): Promise<LoadPromptInputResult> {
  const [spaceResult, briefResult] = await Promise.all([
    args.supabase
      .from("spaces")
      .select("id, property_id, space_type, label, properties(address, city, state, arv_estimate, buyer_persona)")
      .eq("id", args.spaceId)
      .maybeSingle(),
    args.supabase
      .from("space_briefs")
      .select(
        "id, space_id, version, surface_type, creative_answers, non_negotiables, category_moodboards",
      )
      .eq("space_id", args.spaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (spaceResult.error || !spaceResult.data) {
    return { ok: false, error: "space_not_found" };
  }

  const spaceRow = spaceResult.data as unknown as {
    id: string;
    property_id: string;
    space_type: string;
    label: string;
    properties?:
      | {
          address: string;
          city: string;
          state: string;
          arv_estimate: number | null;
          buyer_persona: string | null;
        }
      | Array<{
          address: string;
          city: string;
          state: string;
          arv_estimate: number | null;
          buyer_persona: string | null;
        }>
      | null;
  };

  const propertyRow = Array.isArray(spaceRow.properties)
    ? spaceRow.properties[0]
    : spaceRow.properties ?? null;
  if (!propertyRow) {
    return { ok: false, error: "property_not_found" };
  }

  if (!briefResult.data) {
    return { ok: false, error: "no_brief_for_space" };
  }

  const briefRaw = briefResult.data as unknown as {
    id: string;
    surface_type: unknown;
    creative_answers: unknown;
    non_negotiables: unknown;
    category_moodboards: unknown;
  };

  const briefParsed = SpaceBriefSchema.safeParse({
    surface_type: briefRaw.surface_type ?? "interior_room",
    creative_answers: briefRaw.creative_answers ?? {},
    non_negotiables: briefRaw.non_negotiables ?? null,
    category_moodboards: Array.isArray(briefRaw.category_moodboards)
      ? briefRaw.category_moodboards
      : [],
  });
  if (!briefParsed.success) {
    return { ok: false, error: "brief_invalid" };
  }
  const brief: SpaceBrief = briefParsed.data;

  const { data: themeRow } = await args.supabase
    .from("project_themes")
    .select("budget_tier, budget_custom_notes, theme_preset, theme_custom_description")
    .eq("property_id", spaceRow.property_id)
    .maybeSingle();

  let projectTheme: ProjectTheme | null = null;
  if (themeRow) {
    const themeParsed = ProjectThemeSchema.safeParse(themeRow);
    if (themeParsed.success) {
      projectTheme = themeParsed.data;
    }
  }

  const input = buildRenderPromptInput({
    property: {
      address: propertyRow.address,
      city_state: `${propertyRow.city}, ${propertyRow.state}`,
      arv_estimate:
        propertyRow.arv_estimate != null ? Number(propertyRow.arv_estimate) : null,
      buyer_persona: propertyRow.buyer_persona ?? null,
    },
    project_theme: projectTheme,
    space: {
      space_type: spaceRow.space_type,
      label: spaceRow.label,
    },
    brief,
    base_photo_description: args.basePhotoDescription,
  });

  return { ok: true, input, brief_id: briefRaw.id };
}
