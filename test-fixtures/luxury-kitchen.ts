import type { RoomSpec, PropertyContext } from "../lib/specs/schema";

/**
 * Test fixture: Luxury kitchen for a high-ARV property.
 *
 * ARV $1.4M + 25% rehab ratio → luxury tier per deriveBudgetTier.
 * Premium materials across the board: unlacquered brass everywhere, honed
 * marble counters, custom inset cabinetry, Wolf range, panel-ready Sub-Zero.
 *
 * Purpose in 2.5: test whether Opus catches drift on expensive-materials
 * rendering where fidelity matters most. Marble vs quartz, inset vs overlay,
 * Wolf vs generic stainless — these are the distinctions that separate an
 * on-spec luxury render from a mid-tier one.
 */

export const luxuryKitchenContext: PropertyContext = {
  address: "Lake Harriet Blvd, Minneapolis, MN",
  arv: 1_400_000,
  purchase_price: 950_000,
  rehab_budget: 360_000,
  buyer_persona: "luxury",
  neighborhood_notes: "Lake Harriet, established luxury market, comps $1.2M–$1.6M",
  style_direction: "classic English with Belgian-farmhouse undertones, unlacquered brass and honed marble",
};

export const luxuryKitchenSpec: RoomSpec = {
  room_type: "kitchen",
  room_name: "Primary Kitchen",
  dimensions: "16x20",
  ceiling_height: "10 ft",
  existing_to_keep: [
    "south-facing bay window over sink",
    "original 1920s plaster crown detail",
    "doorway to butler's pantry on north wall",
  ],
  layout_notes: "Galley plus 5x10 freestanding island. Custom range wall with paneled hood surround running to coffered ceiling.",

  paint: {
    walls: {
      brand: "benjamin_moore",
      color_name: "White Dove",
      color_code: "OC-17",
      sheen: "eggshell",
      hex_approx: "#ECE8DD",
    },
    trim: {
      brand: "benjamin_moore",
      color_name: "White Dove",
      color_code: "OC-17",
      sheen: "semi_gloss",
      hex_approx: "#ECE8DD",
    },
    ceiling: {
      brand: "benjamin_moore",
      color_name: "White Dove",
      color_code: "OC-17",
      sheen: "flat",
      hex_approx: "#ECE8DD",
    },
    accent_wall: null,
    accent_wall_location: null,
  },

  flooring: {
    material: "hardwood",
    product: {
      product_name: "Wide-plank rift-and-quartered white oak, unfinished",
      brand: "Carlisle",
      sku: "WPLK-RQ-10",
      supplier: "other",
      supplier_url: null,
      unit_cost: 18,
      quantity: 320,
      notes: "10\" wide, site-finished with Rubio Monocoat Natural",
    },
    color_tone: "white_oak",
    finish: "matte",
    plank_or_tile_size: "10\" plank",
    pattern: "standard",
    orientation_notes: "parallel to the longest wall (north-south)",
  },

  lighting: {
    fixtures: [
      {
        fixture_type: "pendant",
        quantity: 3,
        finish: "unlacquered_brass",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "Quincy Pendant",
          brand: "Urban Electric Co.",
          sku: "QNCY-16-UB",
          supplier: "other",
          supplier_url: null,
          unit_cost: 1850,
          quantity: 3,
          notes: "16\" opal glass shade, unlacquered brass, over island",
        },
        location_notes: "over island, evenly spaced, 34\" above counter",
      },
      {
        fixture_type: "sconce",
        quantity: 2,
        finish: "unlacquered_brass",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "Riverton Sconce",
          brand: "Urban Electric Co.",
          sku: "RVTN-UB",
          supplier: "other",
          supplier_url: null,
          unit_cost: 1250,
          quantity: 2,
          notes: "flanking the range wall",
        },
        location_notes: "flanking range wall above counter",
      },
      {
        fixture_type: "recessed",
        quantity: 6,
        finish: "white",
        bulb_temp_kelvin: 2700,
        product: {
          product_name: "DMF 4\" LED Trimless",
          brand: "DMF",
          sku: "M4-TRIM-27K",
          supplier: "other",
          supplier_url: null,
          unit_cost: 95,
          quantity: 6,
          notes: "trimless, 2700K, dimmable",
        },
        location_notes: "perimeter work zones",
      },
    ],
    dimmer_required: true,
    natural_light_quality: "bright_morning",
  },

  cabinetry: {
    style: "inset",
    door_overlay: "inset",
    color: {
      brand: "benjamin_moore",
      color_name: "White Dove",
      color_code: "OC-17",
      sheen: "satin",
      hex_approx: "#ECE8DD",
    },
    hardware: {
      type: "mixed",
      finish: "unlacquered_brass",
      size: "6\" bar pulls on drawers, 1.5\" bin pulls on cabinet doors, 1.25\" knobs elsewhere",
      product: {
        product_name: "Devon Bar Pull and Bin Pull Set",
        brand: "Rejuvenation",
        sku: "DVN-UB-MIX",
        supplier: "rejuvenation",
        supplier_url: null,
        unit_cost: 42,
        quantity: 38,
        notes: "unlacquered brass, will patina naturally",
      },
    },
    island: {
      present: true,
      size: "5x10",
      color: {
        brand: "benjamin_moore",
        color_name: "Hale Navy",
        color_code: "HC-154",
        sheen: "satin",
        hex_approx: "#3A4253",
      },
      seating: 4,
    },
    upper_cabinets_to_ceiling: true,
  },

  counters: {
    material: "marble",
    product: {
      product_name: "Calacatta Gold honed marble slab",
      brand: null,
      sku: "CAL-GOLD-HONED-3CM",
      supplier: "other",
      supplier_url: null,
      unit_cost: 185,
      quantity: 85,
      notes: "honed, 3cm, with 2\" mitered edge; owner accepts patina",
    },
    pattern_name: "Calacatta Gold",
    edge_profile: "mitered_waterfall",
    thickness: "3cm",
    waterfall_sides: 2,
  },

  backsplash: {
    material: "natural_stone",
    product: {
      product_name: "Calacatta Gold honed marble slab backsplash",
      brand: null,
      sku: "CAL-GOLD-BS-SLAB",
      supplier: "other",
      supplier_url: null,
      unit_cost: 185,
      quantity: 48,
      notes: "slab backsplash from counter to hood, bookmatched",
    },
    tile_size: "full slab",
    pattern: "none",
    grout_color: "tile_matched",
    extent: "behind_range_only",
  },

  appliances: [
    {
      type: "range",
      finish: "stainless",
      product: {
        product_name: "Wolf 48\" Dual Fuel Range",
        brand: "Wolf",
        sku: "DF48650G-S-P",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 14_995,
        quantity: 1,
        notes: "6 burners + griddle, red knobs, stainless",
      },
    },
    {
      type: "hood",
      finish: "panel_ready",
      product: {
        product_name: "Custom paneled hood surround to ceiling",
        brand: null,
        sku: null,
        supplier: "custom_cabinet_shop",
        supplier_url: null,
        unit_cost: 4500,
        quantity: 1,
        notes: "White Dove inset paneling wrapping integrated Vent-A-Hood liner",
      },
    },
    {
      type: "refrigerator",
      finish: "panel_ready",
      product: {
        product_name: "Sub-Zero 36\" Integrated Column Refrigerator",
        brand: "Sub-Zero",
        sku: "IC-36R",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 12_995,
        quantity: 1,
        notes: "fully integrated column, matching inset panels",
      },
    },
    {
      type: "wine_fridge",
      finish: "panel_ready",
      product: {
        product_name: "Sub-Zero 24\" Integrated Wine Storage",
        brand: "Sub-Zero",
        sku: "IW-24",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 6995,
        quantity: 1,
        notes: "integrated in island",
      },
    },
    {
      type: "dishwasher",
      finish: "panel_ready",
      product: {
        product_name: "Miele G 7366 SCVi SF",
        brand: "Miele",
        sku: "G7366SCVISF",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 2499,
        quantity: 1,
        notes: "fully integrated, inset panel",
      },
    },
  ],

  plumbing: [
    {
      fixture_type: "faucet_kitchen",
      finish: "unlacquered_brass",
      product: {
        product_name: "Waterworks Henry Articulated Kitchen Faucet",
        brand: "Waterworks",
        sku: "HKF-UB",
        supplier: "other",
        supplier_url: null,
        unit_cost: 2395,
        quantity: 1,
        notes: "articulated, two-hole, unlacquered brass",
      },
      style_notes: "articulated with side spray",
    },
    {
      fixture_type: "sink_kitchen",
      finish: "white",
      product: {
        product_name: "Shaws Original 36\" Fireclay Apron",
        brand: "Shaws",
        sku: "SHAWS-36-AP",
        supplier: "ferguson",
        supplier_url: null,
        unit_cost: 1895,
        quantity: 1,
        notes: "fireclay farmhouse, single bowl",
      },
      style_notes: "fireclay apron-front",
    },
    {
      fixture_type: "faucet_kitchen",
      finish: "unlacquered_brass",
      product: {
        product_name: "Waterworks Henry Bar Faucet",
        brand: "Waterworks",
        sku: "HBF-UB",
        supplier: "other",
        supplier_url: null,
        unit_cost: 1195,
        quantity: 1,
        notes: "island prep sink faucet",
      },
      style_notes: "single handle, island",
    },
  ],

  estimated_material_cost: 98_500,
};

export const luxuryKitchenBasePhotoDescription = `1920s Tudor kitchen, 16x20, last remodeled in the early 2000s. Medium-stained cherry cabinets with raised panel fronts, crown molding above, crackle-finish ceramic tile backsplash (green and cream). Granite counters, beige-speckled. Travertine floor. Electric Jenn-Air range, stainless side-by-side fridge, black dishwasher. South-facing bay window over sink, three double-hung. Doorway to butler's pantry on north wall. Original plaster crown molding intact at ceiling. 10-foot ceiling with dated drum semi-flush light in center. Walls painted terracotta.`;
