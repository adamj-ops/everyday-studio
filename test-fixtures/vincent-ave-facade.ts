import type { ProjectTheme, SpaceBrief } from "../lib/briefs/schema";
import type {
  PromptInputProperty,
  PromptInputSpace,
  RenderPromptInput,
} from "../lib/briefs/prompt-input";
import { buildRenderPromptInput } from "../lib/briefs/prompt-input";

export const vincentAveFacadeProperty: PromptInputProperty = {
  address: "Vincent Ave N, Minneapolis, MN",
  city_state: "Minneapolis, MN",
  arv_estimate: 485_000,
  buyer_persona: "young_family",
};

export const vincentAveFacadeSpace: PromptInputSpace = {
  space_type: "facade",
  label: "Front Facade",
};

export const vincentAveFacadeTheme: ProjectTheme = {
  budget_tier: "mid_tier",
  budget_custom_notes: null,
  theme_preset: "craftsman",
  theme_custom_description: null,
};

export const vincentAveFacadeBrief: SpaceBrief = {
  surface_type: "facade",
  creative_answers: {
    creative_direction:
      "Respect the bungalow bones, but make the front read cared-for and buyer-ready. Warm off-white siding, restored dark trim, a stronger front door color, and porch lighting should make it feel established rather than flipped.",
    hero_moment:
      "The front entry and porch should be the anchor: restored columns, a confident door, simple house numbers, and warm light.",
    materials_excitement:
      "Painted lap siding, stained wood at the door, blackened bronze lighting, repaired concrete steps, and simple foundation planting.",
    avoid:
      "No black-and-white modern farmhouse overcorrection. Do not move windows, change the roofline, or erase craftsman character.",
    references:
      "Twin Cities craftsman bungalows, Gil Schafer restraint, and Studio McGee exterior simplicity without the trendiness.",
  },
  non_negotiables:
    "Must preserve the existing roofline, porch footprint, front window positions, and stair location. Must keep the facade plausible for a mid-tier Minneapolis flip.",
  category_moodboards: [
    {
      category_key: "palette",
      category_label: "Palette",
      image_storage_paths: ["property/vincent-ave/facade/palette/01.jpg"],
      notes: "Warm white siding, dark olive-black trim, stained wood door, soft brass/bronze lighting.",
    },
    {
      category_key: "materials",
      category_label: "Materials",
      image_storage_paths: [],
      notes: "Painted lap siding, repaired porch concrete, simple wood rail, historically quiet trim.",
    },
  ],
};

export const vincentAveFacadeBasePhotoDescription =
  "Before-state front exterior of a Minneapolis bungalow. Existing low roofline, small covered porch, lap siding, front stair, and symmetrical front windows are visible. Paint is tired, porch lighting is dated, and foundation planting is sparse.";

export const vincentAveFacadePromptInput: RenderPromptInput = buildRenderPromptInput({
  property: vincentAveFacadeProperty,
  project_theme: vincentAveFacadeTheme,
  space: vincentAveFacadeSpace,
  brief: vincentAveFacadeBrief,
  base_photo_description: vincentAveFacadeBasePhotoDescription,
});
