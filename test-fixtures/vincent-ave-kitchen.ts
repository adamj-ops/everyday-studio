import type { ProjectTheme, SpaceBrief } from "../lib/briefs/schema";
import type {
  PromptInputProperty,
  PromptInputSpace,
  RenderPromptInput,
} from "../lib/briefs/prompt-input";
import { buildRenderPromptInput } from "../lib/briefs/prompt-input";

/**
 * Test fixture — Vincent Ave flip, primary kitchen.
 *
 * Represents the moodboard-driven brief shape that replaced the locked
 * `RoomSpec` discriminated union. Mid-tier budget, warm transitional with
 * brass accents, bungalow-respectful for a young-family buyer.
 *
 * The old RoomSpec version of this fixture lives at
 * `./_legacy/vincent-ave-kitchen.ts` (preserved, not imported).
 */

export const vincentAveProperty: PromptInputProperty = {
  address: "Vincent Ave N, Minneapolis, MN",
  city_state: "Minneapolis, MN",
  arv_estimate: 485_000,
  buyer_persona: "young_family",
};

export const vincentAveSpace: PromptInputSpace = {
  space_type: "kitchen",
  label: "Primary Kitchen",
};

export const vincentAveTheme: ProjectTheme = {
  budget_tier: "mid_tier",
  budget_custom_notes: null,
  theme_preset: "transitional",
  theme_custom_description: null,
};

export const vincentAveKitchenBrief: SpaceBrief = {
  surface_type: "interior_room",
  creative_answers: {
    vibe:
      "Warm and lived-in — a family that cooks every Sunday, layered whites with unlacquered brass that patinas over time.",
    hero_moment:
      "A custom shaker hood running to the ceiling flanked by a zellige backsplash in vertical stack — the cooking wall should anchor the room.",
    cooking_style:
      "Serious home cooks with two school-age kids. Big Saturday breakfasts and weekly sheet-pan dinners. Island seats three for homework and snacks.",
    materials_excitement:
      "Unlacquered brass on the pulls, handmade zellige with visible color variation, honed quartz that reads warm rather than cold.",
    avoid:
      "Not builder-grade. Not all-white or hotel-bland. Not gray. No shiny gold. No subway tile.",
    references:
      "deVOL English classics, Heidi Caillier's Oregon coast house, Plain English quiet restraint.",
    walking_in_feeling:
      "Pour a glass of wine and start cooking. Lived-in but cared for.",
  },
  non_negotiables:
    "Must use unlacquered brass hardware and shaker cabinets painted SW Alabaster. Must preserve the north-facing window over the sink and the cased doorway to the dining room. Must NOT be gray. Panel-ready fridge and dishwasher must read as cabinetry, not stainless.",
  category_moodboards: [
    {
      category_key: "cabinetry",
      category_label: "Cabinetry",
      image_storage_paths: [
        "property/vincent-ave/kitchen/cabinetry/01.jpg",
        "property/vincent-ave/kitchen/cabinetry/02.jpg",
      ],
      notes:
        "Shaker, full overlay, SW Alabaster, uppers to ceiling, 6\" unlacquered brass pulls on drawers + 1.25\" knobs on doors.",
    },
    {
      category_key: "tile_countertops",
      category_label: "Tile & Countertops",
      image_storage_paths: [
        "property/vincent-ave/kitchen/tile/01.jpg",
      ],
      notes:
        "Clé zellige 3x12 weathered white, VERTICAL STACK to ceiling. Cambria Brittanicca Warm quartz, eased edge, 3cm.",
    },
    {
      category_key: "fixtures_sink",
      category_label: "Fixtures & Sink",
      image_storage_paths: [],
      notes:
        "Kohler Purist gooseneck kitchen faucet in matte black with single-bowl Strive undermount.",
    },
    {
      category_key: "appliances",
      category_label: "Appliances",
      image_storage_paths: [],
      notes:
        "Bosch 800 Series slide-in gas range (stainless), panel-ready fridge and dishwasher clad in cabinet panels, custom shaker hood cover running to ceiling.",
    },
    {
      category_key: "flooring_trim",
      category_label: "Flooring & Trim",
      image_storage_paths: [],
      notes:
        "7\" white oak LVP (Mohawk RevWood Plus Elderwood), matte, parallel to longest wall.",
    },
    {
      category_key: "color_mood",
      category_label: "Color & Mood",
      image_storage_paths: [],
      notes:
        "Walls SW Alabaster eggshell, trim and ceiling SW Pure White, bright morning light.",
    },
  ],
};

export const vincentAveKitchenBasePhotoDescription = `Dated 1990s kitchen, 12x14 L-shape. Oak cabinets with raised panel doors, brass-tone knobs. Laminate countertops with speckled beige pattern. Vinyl floor, tan. White appliances. Fluorescent box light on ceiling. North-facing window over sink (single hung, white vinyl, roughly 36"x48"). Doorway to dining room on east wall (no door, cased opening). Peninsula extends from south wall with overhang for two stools. Walls painted pale yellow, in fair condition. Ceiling popcorn texture, white.`;

export const vincentAvePromptInput: RenderPromptInput = buildRenderPromptInput({
  property: vincentAveProperty,
  project_theme: vincentAveTheme,
  space: vincentAveSpace,
  brief: vincentAveKitchenBrief,
  base_photo_description: vincentAveKitchenBasePhotoDescription,
});
