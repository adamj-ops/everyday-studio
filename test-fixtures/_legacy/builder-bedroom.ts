import type { RoomSpec, PropertyContext } from "../lib/specs/schema";

/**
 * Test fixture: builder-tier secondary bedroom for a low-ARV rental flip.
 *
 * ARV $280K + investor_rental persona + tiny rehab ratio → builder tier.
 * Deliberately minimal spec: neutral paint, basic LVP, one flush mount +
 * a ceiling fan, no accent wall. Just enough to render a clean neutral room.
 *
 * Purpose in 2.5: stress-test whether Opus over-flags simplicity. A builder
 * bedroom doesn't need Calacatta or unlacquered brass; a spec with only
 * the essentials should ship_it. If Opus demands we add materials not in
 * the spec, it's over-cautious and the stage is noisy.
 */

export const builderBedroomContext: PropertyContext = {
  address: "Humboldt Ave N, Minneapolis, MN",
  arv: 280_000,
  purchase_price: 155_000,
  rehab_budget: 22_000,
  buyer_persona: "investor_rental",
  neighborhood_notes: "North side rental pocket, 3br/1ba starter stock",
  style_direction: "clean neutral rental, durable finishes, no surprises",
};

export const builderBedroomSpec: RoomSpec = {
  space_type: "secondary_bedroom",
  room_name: "Secondary Bedroom (NW)",
  dimensions: "10x11",
  ceiling_height: "8 ft",
  existing_to_keep: [
    "two west-facing double-hung windows",
    "doorway to hallway on east wall",
    "closet on south wall",
  ],
  layout_notes: null,

  paint: {
    walls: {
      brand: "sherwin_williams",
      color_name: "Agreeable Gray",
      color_code: "SW 7029",
      sheen: "eggshell",
      hex_approx: "#D1CBBD",
    },
    trim: {
      brand: "sherwin_williams",
      color_name: "Pure White",
      color_code: "SW 7005",
      sheen: "semi_gloss",
      hex_approx: "#F1EEE5",
    },
    ceiling: {
      brand: "sherwin_williams",
      color_name: "Pure White",
      color_code: "SW 7005",
      sheen: "flat",
      hex_approx: "#F1EEE5",
    },
    accent_wall: null,
    accent_wall_location: null,
  },

  flooring: {
    material: "lvp",
    product: {
      product_name: "Home Decorators Collection 7\" LVP Natural Oak",
      brand: "Home Decorators",
      sku: "HDC-LVP-NOAK",
      supplier: "home_depot",
      supplier_url: null,
      unit_cost: 2.49,
      quantity: 110,
      notes: "builder-grade, water-resistant",
    },
    color_tone: "natural_oak",
    finish: "matte",
    plank_or_tile_size: "7\" plank",
    pattern: "standard",
    orientation_notes: "parallel to the longer wall",
  },

  lighting: {
    fixtures: [
      {
        fixture_type: "flush_mount",
        quantity: 1,
        finish: "black",
        bulb_temp_kelvin: 3000,
        product: {
          product_name: "Hampton Bay 13\" LED Flush Mount",
          brand: "Hampton Bay",
          sku: "HB-FM13-BLK",
          supplier: "home_depot",
          supplier_url: null,
          unit_cost: 39,
          quantity: 1,
          notes: "integrated LED, 3000K, matte black trim",
        },
        location_notes: "center of ceiling",
      },
    ],
    dimmer_required: false,
    natural_light_quality: "bright_afternoon",
  },

  closet_notes: "Existing 5-foot single-door closet with one hanging rod and one shelf; keep as-is.",
  ceiling_fan: false,

  estimated_material_cost: 780,
};

export const builderBedroomBasePhotoDescription = `Small 10x11 secondary bedroom, empty, in a mid-century rental house. Carpet (tan, worn), off-white walls, white trim (beat up), white popcorn ceiling with a bare-bulb light fixture in the middle. Two double-hung vinyl windows on the west wall (standard residential size). Closet on the south wall with a bi-fold door (one panel off track). Outlet covers are oversized and yellowed. No crown, no wainscot, no accent wall.`;
