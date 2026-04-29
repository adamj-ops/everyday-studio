import type { ProjectTheme, SpaceBrief } from "../lib/briefs/schema";
import type {
  PromptInputProperty,
  PromptInputSpace,
  RenderPromptInput,
} from "../lib/briefs/prompt-input";
import { buildRenderPromptInput } from "../lib/briefs/prompt-input";

export const lyndaleHardscapeProperty: PromptInputProperty = {
  address: "Lyndale Ave S, Minneapolis, MN",
  city_state: "Minneapolis, MN",
  arv_estimate: 525_000,
  buyer_persona: "young_family",
};

export const lyndaleHardscapeSpace: PromptInputSpace = {
  space_type: "hardscape",
  label: "Driveway and Walkway",
};

export const lyndaleHardscapeTheme: ProjectTheme = {
  budget_tier: "mid_tier",
  budget_custom_notes: null,
  theme_preset: "traditional",
  theme_custom_description: null,
};

export const lyndaleHardscapeBrief: SpaceBrief = {
  surface_type: "hardscape",
  creative_answers: {
    creative_direction:
      "Clean up the curb approach with a durable driveway edge and a clear front walk. It should feel practical for Minnesota winters but more intentional than plain poured concrete everywhere.",
    hero_moment:
      "A welcoming walkway from sidewalk to porch with a subtle curve, crisp edge, and low planting beds on both sides.",
    materials_excitement:
      "Brushed concrete driveway, thermal bluestone or concrete paver walk, black metal edging, compact step lighting, and gravel drainage strip.",
    avoid:
      "No glossy pavers, no busy multi-color pattern, no blocked driveway access, and no grade changes that look unsafe.",
    references:
      "Traditional Minneapolis walkways, restrained bluestone entries, and quiet Belgian-inspired edging.",
  },
  non_negotiables:
    "Must preserve the existing driveway location, sidewalk connection, porch stair approach, and garage access. Must account for drainage and snow shoveling.",
  category_moodboards: [
    {
      category_key: "materials",
      category_label: "Materials",
      image_storage_paths: ["property/lyndale/hardscape/materials/01.jpg"],
      notes: "Simple concrete drive with a more elevated paver or bluestone walk; avoid high-contrast paver patterns.",
    },
    {
      category_key: "lighting",
      category_label: "Lighting",
      image_storage_paths: [],
      notes: "Low, warm path lighting only where it helps the entry sequence.",
    },
  ],
};

export const lyndaleHardscapeBasePhotoDescription =
  "Before-state front approach with an aging driveway, uneven concrete walk from sidewalk to porch, patchy lawn edges, and a visible porch stair. Grade slopes gently toward the street.";

export const lyndaleHardscapePromptInput: RenderPromptInput = buildRenderPromptInput({
  property: lyndaleHardscapeProperty,
  project_theme: lyndaleHardscapeTheme,
  space: lyndaleHardscapeSpace,
  brief: lyndaleHardscapeBrief,
  base_photo_description: lyndaleHardscapeBasePhotoDescription,
});
