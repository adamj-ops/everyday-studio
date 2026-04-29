import type { RoomSpec } from "../lib/specs/schema";

/**
 * Test fixture: Vincent Ave flip, primary bath.
 *
 * Reuses `vincentAveContext` from ./vincent-ave-kitchen.ts. Same property,
 * different room type — purpose is to see whether Opus catches bath-specific
 * drift (tile surface orientation, vanity style, shower type) during prompt
 * review.
 *
 * Mid-tier to match the Vincent property: Alabaster shaker vanity, quartz
 * top, matte-black plumbing, hex porcelain floor, zellige shower walls,
 * walk-in glass shower.
 */

export { vincentAveContext } from "./vincent-ave-kitchen";

export const vincentAvePrimaryBathSpec: RoomSpec = {
  space_type: "primary_bath",
  room_name: "Primary Bath",
  dimensions: "8x10",
  ceiling_height: "8.5 ft",
  existing_to_keep: [
    "east-facing window (frosted)",
    "doorway to primary bedroom on north wall",
    "existing toilet drain rough-in location",
  ],
  layout_notes: "Vanity on west wall, walk-in shower in southeast corner, toilet on south wall.",

  paint: {
    walls: {
      brand: "sherwin_williams",
      color_name: "Alabaster",
      color_code: "SW 7008",
      sheen: "eggshell",
      hex_approx: "#EDEAE0",
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
    material: "tile_porcelain",
    product: {
      product_name: "Daltile Rittenhouse 2\" Hex Matte White",
      brand: "Daltile",
      sku: "RIT-HEX-2-MW",
      supplier: "home_depot",
      supplier_url: null,
      unit_cost: 6.5,
      quantity: 80,
      notes: "2\" hex, matte white, warm gray grout",
    },
    color_tone: "white",
    finish: "matte",
    plank_or_tile_size: "2\" hex",
    pattern: "none",
    orientation_notes: "standard hex, warm gray grout",
  },

  lighting: {
    fixtures: [
      {
        fixture_type: "sconce",
        quantity: 2,
        finish: "unlacquered_brass",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "Orbit Sconce",
          brand: "Schoolhouse",
          sku: "ORB-SC-UB",
          supplier: "schoolhouse",
          supplier_url: null,
          unit_cost: 289,
          quantity: 2,
          notes: "flanking mirror, 66\" off the floor centers",
        },
        location_notes: "flanking vanity mirror",
      },
      {
        fixture_type: "recessed",
        quantity: 2,
        finish: "white",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "Halo 4\" LED Recessed",
          brand: "Halo",
          sku: "HLB4-27K",
          supplier: "home_depot",
          supplier_url: null,
          unit_cost: 28,
          quantity: 2,
          notes: "one over shower, one over toilet",
        },
        location_notes: "one over shower, one over toilet",
      },
    ],
    dimmer_required: true,
    natural_light_quality: "bright_morning",
  },

  vanity: {
    style: "shaker",
    width: "36 inches",
    single_or_double: "single",
    color: {
      brand: "sherwin_williams",
      color_name: "Alabaster",
      color_code: "SW 7008",
      sheen: "satin",
      hex_approx: "#EDEAE0",
    },
    top_material: "quartz",
    top_product: {
      product_name: "Calacatta-look Quartz",
      brand: "MSI",
      sku: "CALQ-3CM",
      supplier: "other",
      supplier_url: null,
      unit_cost: 65,
      quantity: 8,
      notes: "Calacatta-style warm white with soft gray veining",
    },
    hardware_finish: "unlacquered_brass",
    product: {
      product_name: "Custom shaker vanity, 36\" single",
      brand: null,
      sku: null,
      supplier: "custom_cabinet_shop",
      supplier_url: null,
      unit_cost: 1800,
      quantity: 1,
      notes: "painted Alabaster, soft-close",
    },
  },

  tile_surfaces: [
    {
      location: "shower_walls",
      material: "zellige",
      product: {
        product_name: "Clé Zellige Weathered White",
        brand: "Clé Tile",
        sku: "ZEL-WW-3x12",
        supplier: "other",
        supplier_url: null,
        unit_cost: 22,
        quantity: 60,
        notes: "handmade, expect color variation, to ceiling",
      },
      tile_size: "3x12",
      pattern: "stacked",
      grout_color: "tile_matched",
    },
    {
      location: "shower_floor",
      material: "porcelain",
      product: {
        product_name: "Daltile Rittenhouse 2\" Hex Matte White",
        brand: "Daltile",
        sku: "RIT-HEX-2-MW",
        supplier: "home_depot",
        supplier_url: null,
        unit_cost: 6.5,
        quantity: 12,
        notes: "same 2\" hex as bath floor for continuity, sloped to drain",
      },
      tile_size: "2\" hex",
      pattern: "mosaic",
      grout_color: "warm_gray",
    },
  ],

  plumbing: [
    {
      fixture_type: "faucet_bath",
      finish: "matte_black",
      product: {
        product_name: "Purist Widespread Lav Faucet",
        brand: "Kohler",
        sku: "K-14406-4-BL",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 519,
        quantity: 1,
        notes: "widespread, matte black",
      },
      style_notes: "widespread",
    },
    {
      fixture_type: "showerhead",
      finish: "matte_black",
      product: {
        product_name: "Purist Rain Showerhead",
        brand: "Kohler",
        sku: "K-13688-BL",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 389,
        quantity: 1,
        notes: "8\" rain, wall-mount arm",
      },
      style_notes: "wall-mount rain",
    },
    {
      fixture_type: "toilet",
      finish: "white",
      product: {
        product_name: "Kohler Corbelle Two-Piece",
        brand: "Kohler",
        sku: "K-3814-0",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 449,
        quantity: 1,
        notes: "elongated, comfort height",
      },
      style_notes: null,
    },
    {
      fixture_type: "sink_bath",
      finish: "white",
      product: {
        product_name: "Kohler Caxton Undermount Lav Sink",
        brand: "Kohler",
        sku: "K-2210-0",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 189,
        quantity: 1,
        notes: "17\" oval undermount",
      },
      style_notes: "oval undermount",
    },
  ],

  mirror_notes: "24\" round unlacquered brass mirror centered above vanity",
  shower_type: "walk_in_glass",

  estimated_material_cost: 11_200,
};

export const vincentAvePrimaryBathBasePhotoDescription = `Dated 1990s hall bath, 8x10, converted to primary when the house was last remodeled. Oak vanity with cultured-marble top, chrome fixtures, bone-colored toilet. Shower/tub combo in southeast corner with sliding glass doors and white surround. Beige vinyl tile floor. East-facing frosted window above the toilet. Doorway on north wall to the primary bedroom. Walls painted pale pink, fair condition. Ceiling smooth, low watt vanity-bar fixture above mirror. Ventilation fan in ceiling center.`;
