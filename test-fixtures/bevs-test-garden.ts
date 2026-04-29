import type { ProjectTheme, SpaceBrief } from "../lib/briefs/schema";
import type {
  PromptInputProperty,
  PromptInputSpace,
  RenderPromptInput,
} from "../lib/briefs/prompt-input";
import { buildRenderPromptInput } from "../lib/briefs/prompt-input";

// TODO(adamj-ops): Replace placeholder property facts with Bev's real first
// project address, ARV, and buyer/user context once Hermes sends them.
export const bevsTestGardenProperty: PromptInputProperty = {
  address: "Bev's Garden Co. Test Property",
  city_state: "Minneapolis, MN",
  arv_estimate: null,
  buyer_persona: "bevs_garden_co",
};

export const bevsTestGardenSpace: PromptInputSpace = {
  space_type: "garden",
  label: "First Garden Concept",
};

export const bevsTestGardenTheme: ProjectTheme = {
  budget_tier: "custom",
  budget_custom_notes:
    "Small first-pass garden concept for Bev's Garden Co.; keep it achievable and modular.",
  theme_preset: "custom",
  theme_custom_description:
    "Warm, practical, pollinator-friendly garden with a little kitchen-garden utility.",
};

export const bevsTestGardenBrief: SpaceBrief = {
  surface_type: "garden",
  creative_answers: {
    creative_direction:
      "Create a friendly starter garden that mixes herbs, pollinator flowers, and a few containers. It should feel useful and joyful, not like a formal estate garden.",
    hero_moment:
      "A compact raised bed with herbs and pollinator flowers, framed by containers and a simple trellis.",
    materials_excitement:
      "Cedar raised beds, terra cotta containers, pea gravel path, basil, thyme, salvia, coneflower, and trailing annuals.",
    avoid:
      "No high-maintenance formal hedging, no tropical-only plant palette, no cluttered collection of mismatched pots.",
    references:
      "Kitchen gardens, Terrain container groupings, Midwest pollinator planting, and Bev's Garden Co. practical warmth.",
  },
  non_negotiables:
    "Must specify season and plant maturity. Must keep paths usable and containers realistic for a small urban property.",
  category_moodboards: [
    {
      category_key: "planting",
      category_label: "Planting",
      image_storage_paths: ["property/bevs-test/garden/planting/01.jpg"],
      notes: "Herbs plus pollinator flowers, shown in early summer with enough maturity to feel lush but newly maintainable.",
    },
    {
      category_key: "materials",
      category_label: "Materials",
      image_storage_paths: [],
      notes: "Cedar, terra cotta, pea gravel, simple black metal trellis.",
    },
  ],
};

export const bevsTestGardenBasePhotoDescription =
  "Placeholder before-state for Bev's first project: small urban side or backyard garden area with partial sun, plain lawn or mulch, and room for raised beds and containers. TODO(adamj-ops): replace with real photo description.";

export const bevsTestGardenPromptInput: RenderPromptInput = buildRenderPromptInput({
  property: bevsTestGardenProperty,
  project_theme: bevsTestGardenTheme,
  space: bevsTestGardenSpace,
  brief: bevsTestGardenBrief,
  base_photo_description: bevsTestGardenBasePhotoDescription,
});
