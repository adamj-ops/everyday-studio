import type { RoomSpec, PropertyContext } from "../lib/specs/schema";

/**
 * Test fixture: Vincent Ave flip, primary kitchen.
 *
 * Target buyer: young family (Minneapolis neighborhood pricing).
 * Mid-tier budget: warm transitional with brass accents.
 *
 * This is what a fully-filled spec looks like after Stage 2 of the workflow.
 */

export const vincentAveContext: PropertyContext = {
  address: "Vincent Ave N, Minneapolis, MN",
  arv: 485_000,
  purchase_price: 285_000,
  rehab_budget: 72_000,
  buyer_persona: "young_family",
  neighborhood_notes: "North Minneapolis bungalow, family neighborhood, schools nearby",
  style_direction: "warm transitional with brass accents, bungalow-respectful",
};

export const vincentAveKitchenSpec: RoomSpec = {
  room_type: "kitchen",
  room_name: "Primary Kitchen",
  dimensions: "12x14",
  ceiling_height: "8.5 ft",
  existing_to_keep: [
    "north-facing window over sink",
    "doorway to dining room on east wall",
    "original hardwood floors in adjoining rooms",
  ],
  layout_notes: "L-shape with 4-foot island replacing peninsula",

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
    material: "lvp",
    product: {
      product_name: "Mohawk RevWood Plus Elderwood",
      brand: "Mohawk",
      sku: "RWP01-07",
      supplier: "home_depot",
      supplier_url: null,
      unit_cost: 3.29,
      quantity: 168, // sq ft
      notes: "7\" plank, matte, water-resistant",
    },
    color_tone: "white_oak",
    finish: "matte",
    plank_or_tile_size: "7\" plank",
    pattern: "standard",
    orientation_notes: "parallel to longest wall (east-west)",
  },

  lighting: {
    fixtures: [
      {
        fixture_type: "pendant",
        quantity: 2,
        finish: "unlacquered_brass",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "Isaac Pendant",
          brand: "Schoolhouse",
          sku: "ISAAC-BR-12",
          supplier: "schoolhouse",
          supplier_url: null,
          unit_cost: 349,
          quantity: 2,
          notes: "12\" shade, brass, over island",
        },
        location_notes: "over island, 36\" apart, 32\" above counter",
      },
      {
        fixture_type: "recessed",
        quantity: 4,
        finish: "white",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "Halo 4\" LED Recessed",
          brand: "Halo",
          sku: "HLB4-27K",
          supplier: "home_depot",
          supplier_url: null,
          unit_cost: 28,
          quantity: 4,
          notes: "2700K warm dim, dimmable",
        },
        location_notes: "evenly spaced along perimeter work zones",
      },
    ],
    dimmer_required: true,
    natural_light_quality: "bright_morning",
  },

  cabinetry: {
    style: "shaker",
    door_overlay: "full_overlay",
    color: {
      brand: "sherwin_williams",
      color_name: "Alabaster",
      color_code: "SW 7008",
      sheen: "satin",
      hex_approx: "#EDEAE0",
    },
    hardware: {
      type: "mixed",
      finish: "unlacquered_brass",
      size: "6\" pulls on drawers, 1.25\" knobs on doors",
      product: {
        product_name: "Tum Drawer Pull",
        brand: "Rejuvenation",
        sku: "TUM-6-UB",
        supplier: "rejuvenation",
        supplier_url: null,
        unit_cost: 28,
        quantity: 24,
        notes: "unlacquered brass, will patina naturally",
      },
    },
    island: {
      present: true,
      size: "4x8",
      color: {
        brand: "sherwin_williams",
        color_name: "Alabaster",
        color_code: "SW 7008",
        sheen: "satin",
        hex_approx: "#EDEAE0",
      },
      seating: 3,
    },
    upper_cabinets_to_ceiling: true,
  },

  counters: {
    material: "quartz",
    product: {
      product_name: "Cambria Brittanicca Warm",
      brand: "Cambria",
      sku: "BRIT-WARM-3CM",
      supplier: "other",
      supplier_url: null,
      unit_cost: 75, // per sq ft installed
      quantity: 45,
      notes: "through local fabricator",
    },
    pattern_name: "Brittanicca Warm",
    edge_profile: "eased",
    thickness: "3cm",
    waterfall_sides: 0,
  },

  backsplash: {
    material: "zellige",
    product: {
      product_name: "Clé Zellige Weathered White",
      brand: "Clé Tile",
      sku: "ZEL-WW-3x12",
      supplier: "other",
      supplier_url: null,
      unit_cost: 22, // per sq ft
      quantity: 32,
      notes: "handmade, expect color variation",
    },
    tile_size: "3x12",
    pattern: "stacked_vertical",
    grout_color: "tile_matched",
    extent: "to_ceiling",
  },

  appliances: [
    {
      type: "range",
      finish: "stainless",
      product: {
        product_name: "Bosch 800 Series 30\" Slide-In Gas Range",
        brand: "Bosch",
        sku: "HGI8056UC",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 2899,
        quantity: 1,
        notes: null,
      },
    },
    {
      type: "hood",
      finish: "panel_ready",
      product: {
        product_name: "Custom shaker hood cover",
        brand: null,
        sku: null,
        supplier: "custom_cabinet_shop",
        supplier_url: null,
        unit_cost: 1200,
        quantity: 1,
        notes: "matches cabinetry, runs to ceiling",
      },
    },
    {
      type: "refrigerator",
      finish: "panel_ready",
      product: {
        product_name: "Bosch 800 Series 36\" Counter-Depth",
        brand: "Bosch",
        sku: "B36CL80ENS",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 3499,
        quantity: 1,
        notes: "panel-ready, counter-depth",
      },
    },
    {
      type: "dishwasher",
      finish: "panel_ready",
      product: {
        product_name: "Bosch 800 Series Panel-Ready",
        brand: "Bosch",
        sku: "SHV88PZ63N",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 1399,
        quantity: 1,
        notes: null,
      },
    },
  ],

  plumbing: [
    {
      fixture_type: "faucet_kitchen",
      finish: "matte_black",
      product: {
        product_name: "Purist Gooseneck Kitchen Faucet",
        brand: "Kohler",
        sku: "K-7505-BL",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 589,
        quantity: 1,
        notes: "gooseneck, single handle",
      },
      style_notes: "gooseneck, single handle",
    },
    {
      fixture_type: "sink_kitchen",
      finish: "stainless",
      product: {
        product_name: "Strive 32\" Single Bowl Undermount",
        brand: "Kohler",
        sku: "K-5282-NA",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 649,
        quantity: 1,
        notes: "single bowl, 9\" deep",
      },
      style_notes: "single bowl undermount",
    },
  ],

  estimated_material_cost: 18_400,
};

/**
 * Hand-written description of the before photo, as a designer would note it.
 * In the production app, this comes from either:
 *   - a short Claude vision call that describes the CompanyCam photo, or
 *   - a free-text field the designer fills in when uploading
 */
export const vincentAveKitchenBasePhotoDescription = `Dated 1990s kitchen, 12x14 L-shape. Oak cabinets with raised panel doors, brass-tone knobs. Laminate countertops with speckled beige pattern. Vinyl floor, tan. White appliances. Fluorescent box light on ceiling. North-facing window over sink (single hung, white vinyl, roughly 36"x48"). Doorway to dining room on east wall (no door, cased opening). Peninsula extends from south wall with overhang for two stools. Walls painted pale yellow, in fair condition. Ceiling popcorn texture, white.`;
