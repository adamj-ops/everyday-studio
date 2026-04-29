import { z } from "zod";

export const BudgetTierEnum = z.enum([
  "builder_grade",
  "mid_tier",
  "high_end",
  "luxury",
  "custom",
]);
export type BudgetTier = z.infer<typeof BudgetTierEnum>;

export const ThemePresetEnum = z.enum([
  "japandi",
  "scandinavian",
  "modern_farmhouse",
  "craftsman",
  "mid_century_modern",
  "organic_modern",
  "traditional",
  "transitional",
  "coastal",
  "industrial",
  "custom",
]);
export type ThemePreset = z.infer<typeof ThemePresetEnum>;

export const SurfaceTypeEnum = z.enum([
  "interior_room",
  "facade",
  "hardscape",
  "landscape",
  "garden",
]);
export type SurfaceType = z.infer<typeof SurfaceTypeEnum>;

export const ProjectThemeSchema = z
  .object({
    budget_tier: BudgetTierEnum,
    budget_custom_notes: z.string().max(2000).nullable().optional(),
    theme_preset: ThemePresetEnum.nullable().optional(),
    theme_custom_description: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.budget_tier !== "custom" ||
      (typeof v.budget_custom_notes === "string" && v.budget_custom_notes.trim().length > 0),
    {
      message: "budget_custom_notes required when budget_tier is 'custom'",
      path: ["budget_custom_notes"],
    },
  )
  .refine(
    (v) =>
      v.theme_preset !== "custom" ||
      (typeof v.theme_custom_description === "string" &&
        v.theme_custom_description.trim().length > 0),
    {
      message: "theme_custom_description required when theme_preset is 'custom'",
      path: ["theme_custom_description"],
    },
  );
export type ProjectTheme = z.infer<typeof ProjectThemeSchema>;

export const CategoryMoodboardSchema = z.object({
  category_key: z.string().min(1).max(80),
  category_label: z.string().min(1).max(120),
  image_storage_paths: z.array(z.string().min(1)).max(10).default([]),
  notes: z.string().max(1000).nullable().default(null),
});
export type CategoryMoodboard = z.infer<typeof CategoryMoodboardSchema>;

export const SpaceBriefSchema = z.object({
  surface_type: SurfaceTypeEnum.default("interior_room"),
  creative_answers: z.record(z.string(), z.string()).default({}),
  non_negotiables: z.string().max(4000).nullable().default(null),
  category_moodboards: z.array(CategoryMoodboardSchema).default([]),
});
export type SpaceBrief = z.infer<typeof SpaceBriefSchema>;

/**
 * Row shapes as persisted in Supabase. Kept separate from the application
 * schemas because `id`/`version`/timestamps live on the row, not in the
 * editable payload.
 */
export interface ProjectThemeRow extends ProjectTheme {
  id: string;
  property_id: string;
  created_at: string;
  updated_at: string;
}

export interface SpaceBriefRow extends SpaceBrief {
  id: string;
  space_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}
