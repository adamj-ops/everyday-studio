import type { ProjectTheme, SpaceBrief } from "../lib/briefs/schema";
import type {
  PromptInputProperty,
  PromptInputSpace,
  RenderPromptInput,
} from "../lib/briefs/prompt-input";
import { buildRenderPromptInput } from "../lib/briefs/prompt-input";

export const lyndaleLandscapeProperty: PromptInputProperty = {
  address: "Lyndale Ave S, Minneapolis, MN",
  city_state: "Minneapolis, MN",
  arv_estimate: 525_000,
  buyer_persona: "young_family",
};

export const lyndaleLandscapeSpace: PromptInputSpace = {
  space_type: "landscape",
  label: "Front Yard Plantings",
};

export const lyndaleLandscapeTheme: ProjectTheme = {
  budget_tier: "mid_tier",
  budget_custom_notes: null,
  theme_preset: "organic_modern",
  theme_custom_description: null,
};

export const lyndaleLandscapeBrief: SpaceBrief = {
  surface_type: "landscape",
  creative_answers: {
    creative_direction:
      "Make the front yard feel soft, established, and regionally appropriate. Use layered native-inspired planting that frames the house without hiding windows or making maintenance look intense.",
    hero_moment:
      "A generous mixed border along the front walk with grasses, white flowers, and late-season texture.",
    materials_excitement:
      "Native grasses, hydrangea-like structure, coneflower, sedges, dark mulch, simple boulders, and a cleaner lawn edge.",
    avoid:
      "No tropical plants, no overgrown cottage chaos, no hiding the porch, and no plants that look wrong for Minneapolis winters.",
    references:
      "Piet Oudolf massing, Midwest prairie plantings, and tidy family-home curb appeal.",
  },
  non_negotiables:
    "Must preserve front-window sightlines, sidewalk visibility, and a simple mowable lawn area. Plantings should read hardy for Minneapolis.",
  category_moodboards: [
    {
      category_key: "planting",
      category_label: "Planting",
      image_storage_paths: ["property/lyndale/landscape/planting/01.jpg"],
      notes: "Layered native-inspired drifts with grasses, white blooms, and seedhead texture; show a 2-3 year maturity, not instant jungle.",
    },
    {
      category_key: "details",
      category_label: "Details",
      image_storage_paths: [],
      notes: "Clean bed edges, dark mulch, and a few natural boulders for structure.",
    },
  ],
};

export const lyndaleLandscapeBasePhotoDescription =
  "Before-state front yard with patchy lawn, sparse foundation shrubs, exposed mulch beds, and clear views to porch and front windows. Sidewalk and driveway edges are visible.";

export const lyndaleLandscapePromptInput: RenderPromptInput = buildRenderPromptInput({
  property: lyndaleLandscapeProperty,
  project_theme: lyndaleLandscapeTheme,
  space: lyndaleLandscapeSpace,
  brief: lyndaleLandscapeBrief,
  base_photo_description: lyndaleLandscapeBasePhotoDescription,
});
