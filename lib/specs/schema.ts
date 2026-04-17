import { z } from "zod";

/**
 * Everyday Studio — Room Specification Schema
 *
 * This is the locked data contract for every room in a property.
 * Once a spec is locked, it becomes the single source of truth for:
 *   - render prompt generation
 *   - render QA review
 *   - contractor build sheets (Phase 2)
 *   - MLS staging guardrails (Phase 3)
 *
 * Design principles:
 *   1. Every material field carries enough info to re-render OR buy it.
 *   2. Structured enums where choice is finite; free text where it isn't.
 *   3. Nullable instead of omitted — explicit "none" beats missing.
 *   4. Supplier + SKU live with the spec so contractor sheets are trivial.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const SupplierEnum = z.enum([
  "home_depot",
  "lowes",
  "menards",
  "ferguson",
  "sherwin_williams",
  "benjamin_moore",
  "floor_decor",
  "rejuvenation",
  "schoolhouse",
  "build_com",
  "wayfair",
  "custom_cabinet_shop",
  "other",
]);
export type Supplier = z.infer<typeof SupplierEnum>;

export const SheenEnum = z.enum([
  "flat",
  "matte",
  "eggshell",
  "satin",
  "semi_gloss",
  "gloss",
]);

export const FinishEnum = z.enum([
  "polished_chrome",
  "brushed_nickel",
  "matte_black",
  "unlacquered_brass",
  "satin_brass",
  "aged_brass",
  "bronze",
  "stainless",
  "champagne_bronze",
  "gold",
  "white",
  "black",
  "other",
]);
export type Finish = z.infer<typeof FinishEnum>;

/** Anything a contractor needs to buy it. */
export const SourcedProductSchema = z.object({
  product_name: z.string().min(1),
  brand: z.string().nullable(),
  sku: z.string().nullable(),
  supplier: SupplierEnum,
  supplier_url: z.string().url().nullable(),
  unit_cost: z.number().nonnegative().nullable(),
  quantity: z.number().positive().nullable(),
  notes: z.string().nullable(),
});
export type SourcedProduct = z.infer<typeof SourcedProductSchema>;

// ---------------------------------------------------------------------------
// Paint — applies to every room
// ---------------------------------------------------------------------------

export const PaintColorSchema = z.object({
  brand: z.enum(["sherwin_williams", "benjamin_moore", "other"]),
  color_name: z.string().min(1), // e.g., "Alabaster"
  color_code: z.string().nullable(), // e.g., "SW 7008"
  sheen: SheenEnum,
  hex_approx: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(), // for moodboard + render tinting
});
export type PaintColor = z.infer<typeof PaintColorSchema>;

export const PaintSpecSchema = z.object({
  walls: PaintColorSchema,
  trim: PaintColorSchema,
  ceiling: PaintColorSchema,
  accent_wall: PaintColorSchema.nullable(),
  accent_wall_location: z.string().nullable(), // e.g., "behind bed, north wall"
});
export type PaintSpec = z.infer<typeof PaintSpecSchema>;

// ---------------------------------------------------------------------------
// Flooring — applies to every room
// ---------------------------------------------------------------------------

export const FlooringSpecSchema = z.object({
  material: z.enum([
    "hardwood",
    "engineered_hardwood",
    "lvp",
    "laminate",
    "tile_porcelain",
    "tile_ceramic",
    "tile_natural_stone",
    "carpet",
    "polished_concrete",
    "other",
  ]),
  product: SourcedProductSchema,
  color_tone: z.enum([
    "white_oak",
    "natural_oak",
    "light_walnut",
    "medium_walnut",
    "dark_walnut",
    "gray_wash",
    "white_wash",
    "ebony",
    "honey",
    "cream",
    "warm_gray",
    "cool_gray",
    "black",
    "white",
    "other",
  ]),
  finish: z.enum(["matte", "satin", "semi_gloss", "gloss", "wire_brushed", "hand_scraped", "none"]),
  plank_or_tile_size: z.string(), // e.g., "7\" plank" or "12x24"
  pattern: z.enum(["standard", "herringbone", "chevron", "stacked", "offset", "diagonal", "none"]),
  orientation_notes: z.string().nullable(), // "parallel to longest wall"
});

// ---------------------------------------------------------------------------
// Lighting — applies to every room
// ---------------------------------------------------------------------------

export const LightFixtureSchema = z.object({
  fixture_type: z.enum([
    "pendant",
    "chandelier",
    "flush_mount",
    "semi_flush",
    "sconce",
    "recessed",
    "track",
    "under_cabinet",
    "vanity_bar",
    "picture_light",
    "other",
  ]),
  quantity: z.number().int().positive(),
  finish: FinishEnum,
  bulb_temp_kelvin: z.number().int().min(2200).max(5000), // 2700 warm, 3000 soft white
  product: SourcedProductSchema,
  location_notes: z.string().nullable(), // "over island", "flanking mirror"
});

export const LightingSpecSchema = z.object({
  fixtures: z.array(LightFixtureSchema).min(1),
  dimmer_required: z.boolean(),
  natural_light_quality: z.enum([
    "bright_morning",
    "bright_afternoon",
    "warm_evening",
    "soft_overcast",
    "dim_interior",
  ]),
});

// ---------------------------------------------------------------------------
// Kitchen-specific
// ---------------------------------------------------------------------------

export const CabinetrySchema = z.object({
  style: z.enum(["shaker", "flat_panel", "slab", "beadboard", "inset", "raised_panel", "other"]),
  door_overlay: z.enum(["full_overlay", "partial_overlay", "inset"]),
  color: PaintColorSchema, // cabinets are painted the same spec as walls
  hardware: z.object({
    type: z.enum(["pull", "knob", "mixed", "none"]),
    finish: FinishEnum,
    size: z.string().nullable(), // '"6" pulls, 1.25" knobs"'
    product: SourcedProductSchema,
  }),
  island: z
    .object({
      present: z.literal(true),
      size: z.string(), // "4x8"
      color: PaintColorSchema,
      seating: z.number().int().nonnegative(),
    })
    .or(z.object({ present: z.literal(false) })),
  upper_cabinets_to_ceiling: z.boolean(),
});

export const CounterSpecSchema = z.object({
  material: z.enum([
    "quartz",
    "quartzite",
    "granite",
    "marble",
    "butcher_block",
    "concrete",
    "solid_surface",
    "laminate",
    "other",
  ]),
  product: SourcedProductSchema,
  pattern_name: z.string().nullable(), // "Calacatta Warm"
  edge_profile: z.enum(["eased", "beveled", "bullnose", "mitered_waterfall", "ogee"]),
  thickness: z.enum(["2cm", "3cm"]),
  waterfall_sides: z.number().int().min(0).max(2),
});

export const BacksplashSchema = z.object({
  material: z.enum([
    "zellige",
    "subway_ceramic",
    "subway_porcelain",
    "glass",
    "natural_stone",
    "quartz_slab",
    "brick",
    "mosaic",
    "none",
  ]),
  product: SourcedProductSchema,
  tile_size: z.string(), // "3x12"
  pattern: z.enum(["stacked_horizontal", "stacked_vertical", "offset", "herringbone", "none"]),
  grout_color: z.enum(["tile_matched", "contrasting_dark", "contrasting_light", "warm_gray"]),
  extent: z.enum(["standard_height", "to_ceiling", "behind_range_only", "full_wall"]),
});

export const ApplianceSchema = z.object({
  type: z.enum([
    "range",
    "wall_oven",
    "cooktop",
    "hood",
    "refrigerator",
    "dishwasher",
    "microwave",
    "wine_fridge",
    "other",
  ]),
  finish: z.enum(["stainless", "panel_ready", "black_stainless", "matte_black", "white", "other"]),
  product: SourcedProductSchema,
});

// ---------------------------------------------------------------------------
// Bath-specific
// ---------------------------------------------------------------------------

export const VanitySchema = z.object({
  style: z.enum(["shaker", "flat_panel", "slab", "furniture_style", "floating", "other"]),
  width: z.string(), // "48 inches"
  single_or_double: z.enum(["single", "double"]),
  color: PaintColorSchema,
  top_material: z.enum([
    "quartz",
    "marble",
    "solid_surface",
    "wood",
    "concrete",
    "other",
  ]),
  top_product: SourcedProductSchema,
  hardware_finish: FinishEnum,
  product: SourcedProductSchema,
});

export const TileSurfaceSchema = z.object({
  location: z.enum(["shower_walls", "shower_floor", "tub_surround", "bath_floor", "accent_niche"]),
  material: z.enum([
    "porcelain",
    "ceramic",
    "marble",
    "zellige",
    "natural_stone",
    "glass",
    "mosaic",
  ]),
  product: SourcedProductSchema,
  tile_size: z.string(),
  pattern: z.enum(["stacked", "offset", "herringbone", "mosaic", "basketweave", "none"]),
  grout_color: z.enum(["tile_matched", "contrasting_dark", "contrasting_light", "warm_gray"]),
});

export const PlumbingFixtureSchema = z.object({
  fixture_type: z.enum([
    "faucet_kitchen",
    "faucet_bath",
    "faucet_tub",
    "showerhead",
    "hand_shower",
    "toilet",
    "sink_kitchen",
    "sink_bath",
    "tub",
    "shower_drain",
  ]),
  finish: FinishEnum,
  product: SourcedProductSchema,
  style_notes: z.string().nullable(), // "gooseneck", "wall-mount", "freestanding"
});

// ---------------------------------------------------------------------------
// Room-type discriminated union
// ---------------------------------------------------------------------------

const BaseRoomSchema = z.object({
  room_name: z.string().min(1),
  dimensions: z.string(), // "12x14"
  ceiling_height: z.string(), // "9 ft"
  existing_to_keep: z.array(z.string()), // ["north-facing window", "exterior door"]
  layout_notes: z.string().nullable(),
  paint: PaintSpecSchema,
  flooring: FlooringSpecSchema,
  lighting: LightingSpecSchema,
  estimated_material_cost: z.number().nonnegative(),
});

export const KitchenSpecSchema = BaseRoomSchema.extend({
  room_type: z.literal("kitchen"),
  cabinetry: CabinetrySchema,
  counters: CounterSpecSchema,
  backsplash: BacksplashSchema,
  appliances: z.array(ApplianceSchema),
  plumbing: z.array(PlumbingFixtureSchema), // kitchen faucet + sink
});

export const BathSpecSchema = BaseRoomSchema.extend({
  room_type: z.enum(["primary_bath", "secondary_bath", "powder"]),
  vanity: VanitySchema.nullable(), // nullable for powder rooms with pedestals
  tile_surfaces: z.array(TileSurfaceSchema),
  plumbing: z.array(PlumbingFixtureSchema),
  mirror_notes: z.string().nullable(),
  shower_type: z.enum(["walk_in_glass", "tub_shower_combo", "freestanding_tub_only", "none"]),
});

export const BedroomSpecSchema = BaseRoomSchema.extend({
  room_type: z.enum(["primary_bedroom", "secondary_bedroom"]),
  closet_notes: z.string().nullable(),
  ceiling_fan: z.boolean(),
});

export const LivingSpecSchema = BaseRoomSchema.extend({
  room_type: z.enum(["living_room", "family_room", "dining_room", "foyer", "hallway", "laundry", "office"]),
  fireplace: z
    .object({
      present: z.literal(true),
      surround_material: z.string(),
      mantel_notes: z.string().nullable(),
    })
    .or(z.object({ present: z.literal(false) }))
    .nullable(),
  built_ins: z.boolean(),
});

/**
 * The full room spec is a discriminated union on `room_type`.
 * TypeScript narrows correctly when you switch on `spec.room_type`.
 */
export const RoomSpecSchema = z.discriminatedUnion("room_type", [
  KitchenSpecSchema,
  BathSpecSchema.extend({ room_type: z.literal("primary_bath") }),
  BathSpecSchema.extend({ room_type: z.literal("secondary_bath") }),
  BathSpecSchema.extend({ room_type: z.literal("powder") }),
  BedroomSpecSchema.extend({ room_type: z.literal("primary_bedroom") }),
  BedroomSpecSchema.extend({ room_type: z.literal("secondary_bedroom") }),
  LivingSpecSchema.extend({ room_type: z.literal("living_room") }),
  LivingSpecSchema.extend({ room_type: z.literal("family_room") }),
  LivingSpecSchema.extend({ room_type: z.literal("dining_room") }),
  LivingSpecSchema.extend({ room_type: z.literal("foyer") }),
  LivingSpecSchema.extend({ room_type: z.literal("hallway") }),
  LivingSpecSchema.extend({ room_type: z.literal("laundry") }),
  LivingSpecSchema.extend({ room_type: z.literal("office") }),
]);

export type RoomSpec = z.infer<typeof RoomSpecSchema>;

// ---------------------------------------------------------------------------
// Property-level context (passed to Claude with every spec)
// ---------------------------------------------------------------------------

export const BuyerPersonaEnum = z.enum([
  "first_time_homebuyer",
  "young_family",
  "young_professional",
  "downsizer",
  "luxury",
  "investor_rental",
]);
export type BuyerPersona = z.infer<typeof BuyerPersonaEnum>;

export const PropertyContextSchema = z.object({
  address: z.string(),
  arv: z.number().positive(),
  purchase_price: z.number().positive(),
  rehab_budget: z.number().positive(),
  buyer_persona: BuyerPersonaEnum,
  neighborhood_notes: z.string().nullable(), // "St. Paul bungalow belt"
  style_direction: z.string().nullable(), // set by the moodboard stage later
});
export type PropertyContext = z.infer<typeof PropertyContextSchema>;

// ---------------------------------------------------------------------------
// Helper: derive budget tier from ARV + rehab ratio
// ---------------------------------------------------------------------------

export function deriveBudgetTier(ctx: PropertyContext): "builder" | "mid" | "high" | "luxury" {
  const ratio = ctx.rehab_budget / ctx.arv;
  if (ctx.arv >= 900_000 || ratio >= 0.25) return "luxury";
  if (ctx.arv >= 500_000 || ratio >= 0.15) return "high";
  if (ctx.arv >= 300_000 || ratio >= 0.08) return "mid";
  return "builder";
}

// ---------------------------------------------------------------------------
// Reference materials — optional designer-supplied image refs attached per render
// ---------------------------------------------------------------------------

export const ReferenceMaterialSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(100),
  material_type: z
    .enum([
      "backsplash",
      "flooring",
      "hardware",
      "counter",
      "cabinet_color",
      "paint",
      "lighting",
      "plumbing",
      "tile",
      "other",
    ])
    .nullable(),
  storage_path: z.string(),
  mime_type: z.string().regex(/^image\//),
});
export type ReferenceMaterial = z.infer<typeof ReferenceMaterialSchema>;
