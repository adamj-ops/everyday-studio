import type {
  PaintColor,
  PaintSpec,
  SourcedProduct,
  RoomSpec,
} from "./schema";

/**
 * Empty-spec factories.
 *
 * PRINCIPLE (per user guardrail): fields without a Zod `.default()` are
 * produced as visibly-empty values — empty strings, null, empty arrays,
 * false for booleans. NEVER filler text like "Unknown" / "TBD" / "None".
 * Zod validation on Save will tell the designer what still needs attention.
 */

const EMPTY_PRODUCT: SourcedProduct = {
  product_name: "",
  brand: null,
  sku: null,
  supplier: "other",
  supplier_url: null,
  unit_cost: null,
  quantity: null,
  notes: null,
};

const EMPTY_PAINT_COLOR: PaintColor = {
  brand: "sherwin_williams",
  color_name: "",
  color_code: null,
  sheen: "eggshell",
  hex_approx: null,
};

const EMPTY_PAINT: PaintSpec = {
  walls: { ...EMPTY_PAINT_COLOR },
  trim: { ...EMPTY_PAINT_COLOR, sheen: "semi_gloss" },
  ceiling: { ...EMPTY_PAINT_COLOR, sheen: "flat" },
  accent_wall: null,
  accent_wall_location: null,
};

function emptyBase(room_name: string) {
  return {
    room_name,
    dimensions: "",
    ceiling_height: "",
    existing_to_keep: [],
    layout_notes: null,
    paint: EMPTY_PAINT,
    flooring: {
      material: "lvp" as const,
      product: { ...EMPTY_PRODUCT },
      color_tone: "white_oak" as const,
      finish: "matte" as const,
      plank_or_tile_size: "",
      pattern: "standard" as const,
      orientation_notes: null,
    },
    lighting: {
      fixtures: [],
      dimmer_required: false,
      natural_light_quality: "bright_afternoon" as const,
    },
    estimated_material_cost: 0,
  };
}

export function getEmptySpec(
  room_type: RoomSpec["room_type"],
  room_name: string,
): RoomSpec {
  const base = emptyBase(room_name);

  switch (room_type) {
    case "kitchen":
      return {
        ...base,
        room_type: "kitchen",
        cabinetry: {
          style: "shaker",
          door_overlay: "full_overlay",
          color: { ...EMPTY_PAINT_COLOR, sheen: "satin" },
          hardware: {
            type: "pull",
            finish: "unlacquered_brass",
            size: null,
            product: { ...EMPTY_PRODUCT },
          },
          island: { present: false },
          upper_cabinets_to_ceiling: false,
        },
        counters: {
          material: "quartz",
          product: { ...EMPTY_PRODUCT },
          pattern_name: null,
          edge_profile: "eased",
          thickness: "3cm",
          waterfall_sides: 0,
        },
        backsplash: {
          material: "none",
          product: { ...EMPTY_PRODUCT },
          tile_size: "",
          pattern: "none",
          grout_color: "tile_matched",
          extent: "standard_height",
        },
        appliances: [],
        plumbing: [],
      };

    case "primary_bath":
    case "secondary_bath":
    case "powder":
      return {
        ...base,
        room_type,
        vanity: null,
        tile_surfaces: [],
        plumbing: [],
        mirror_notes: null,
        shower_type: "none",
      };

    case "primary_bedroom":
    case "secondary_bedroom":
      return {
        ...base,
        room_type,
        closet_notes: null,
        ceiling_fan: false,
      };

    case "living_room":
    case "family_room":
    case "dining_room":
    case "foyer":
    case "hallway":
    case "laundry":
    case "office":
      return {
        ...base,
        room_type,
        fireplace: null,
        built_ins: false,
      };
  }
}
