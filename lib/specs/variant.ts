import { z } from "zod";
import {
  BathSpecSchema,
  BedroomSpecSchema,
  KitchenSpecSchema,
  LivingSpecSchema,
  type RoomSpec,
} from "./schema";

/**
 * Four UI variants matching the four shape-families in the discriminated union.
 * The RoomSpec union has 13 `room_type` literals but only 4 shape families —
 * bathrooms (3 literals) all share BathSpecSchema, bedrooms share BedroomSpecSchema,
 * and 7 living-area literals share LivingSpecSchema.
 */
export type VariantKey = "kitchen" | "bath" | "bedroom" | "living";

export function variantForRoomType(room_type: RoomSpec["room_type"]): VariantKey {
  switch (room_type) {
    case "kitchen":
      return "kitchen";
    case "primary_bath":
    case "secondary_bath":
    case "powder":
      return "bath";
    case "primary_bedroom":
    case "secondary_bedroom":
      return "bedroom";
    case "living_room":
    case "family_room":
    case "dining_room":
    case "foyer":
    case "hallway":
    case "laundry":
    case "office":
      return "living";
  }
}

/**
 * The base (pre-discriminator-extension) schema for each variant, used for
 * introspection by components/specs/field.tsx when it needs to resolve a
 * field path's Zod type. The extended-with-literal variants in the
 * discriminated union are only used for save-time validation.
 */
export function getVariantSchema(room_type: RoomSpec["room_type"]): z.ZodTypeAny {
  switch (variantForRoomType(room_type)) {
    case "kitchen":
      return KitchenSpecSchema;
    case "bath":
      return BathSpecSchema;
    case "bedroom":
      return BedroomSpecSchema;
    case "living":
      return LivingSpecSchema;
  }
}

/**
 * Walk a dotted field path ("paint.walls.color_name") through a Zod schema,
 * returning the leaf schema or null if the path is invalid. Safe on arrays:
 * "appliances.0.type" resolves via ZodArray.element.
 */
export function getFieldSchema(root: z.ZodTypeAny, path: string): z.ZodTypeAny | null {
  let current: z.ZodTypeAny = root;
  for (const segment of path.split(".")) {
    current = unwrap(current);
    if (current instanceof z.ZodObject) {
      const shape = current.shape as Record<string, z.ZodTypeAny>;
      const next = shape[segment];
      if (!next) return null;
      current = next;
    } else if (current instanceof z.ZodArray) {
      // Segment may be an index ("0", "1", ...) or ignored; descend into element.
      current = current.element;
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Loop-unwrap ZodOptional and ZodNullable until a concrete type surfaces.
 * Single-pass unwrap would misrender z.enum([...]).nullable() as a text input.
 */
export function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: z.ZodTypeAny = schema;
  while (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
    s = (s as z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>)._def.innerType;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Section groupings — hand-curated per your Session 5 Step 2 spec. Field paths
// are relative to the spec root; the form renderer resolves each path against
// the variant schema via getFieldSchema.
// ---------------------------------------------------------------------------

export interface Section {
  key: string;
  label: string;
  /** Field paths (relative to spec root) to render in this section, in order. */
  fields: string[];
}

const COMMON_BASICS: Section = {
  key: "basics",
  label: "Basics",
  fields: [
    "room_name",
    "dimensions",
    "ceiling_height",
    "existing_to_keep",
    "layout_notes",
  ],
};

const COMMON_COST: Section = {
  key: "cost",
  label: "Estimated cost",
  fields: ["estimated_material_cost"],
};

const COMMON_PAINT: Section = {
  key: "paint",
  label: "Paint & palette",
  fields: ["paint"],
};

const COMMON_FLOORING: Section = {
  key: "flooring",
  label: "Flooring",
  fields: ["flooring"],
};

const COMMON_LIGHTING: Section = {
  key: "lighting",
  label: "Lighting",
  fields: ["lighting"],
};

const KITCHEN_SECTIONS: Section[] = [
  COMMON_BASICS,
  { key: "cabinetry", label: "Cabinets", fields: ["cabinetry"] },
  { key: "counters", label: "Countertops", fields: ["counters"] },
  { key: "backsplash", label: "Backsplash", fields: ["backsplash"] },
  { key: "appliances", label: "Appliances", fields: ["appliances"] },
  { key: "plumbing", label: "Plumbing", fields: ["plumbing"] },
  COMMON_FLOORING,
  COMMON_LIGHTING,
  COMMON_PAINT,
  COMMON_COST,
];

const BATH_SECTIONS: Section[] = [
  COMMON_BASICS,
  { key: "vanity", label: "Vanity", fields: ["vanity"] },
  { key: "tile_surfaces", label: "Tile surfaces", fields: ["tile_surfaces"] },
  { key: "shower_type", label: "Shower / tub", fields: ["shower_type"] },
  { key: "plumbing", label: "Plumbing fixtures", fields: ["plumbing"] },
  { key: "mirror_notes", label: "Mirror", fields: ["mirror_notes"] },
  COMMON_LIGHTING,
  COMMON_PAINT,
  COMMON_FLOORING,
  COMMON_COST,
];

const BEDROOM_SECTIONS: Section[] = [
  COMMON_BASICS,
  COMMON_PAINT,
  COMMON_FLOORING,
  COMMON_LIGHTING,
  { key: "closet_notes", label: "Closet", fields: ["closet_notes"] },
  { key: "ceiling_fan", label: "Ceiling fan", fields: ["ceiling_fan"] },
  COMMON_COST,
];

const LIVING_SECTIONS: Section[] = [
  COMMON_BASICS,
  COMMON_PAINT,
  COMMON_FLOORING,
  COMMON_LIGHTING,
  { key: "fireplace", label: "Fireplace", fields: ["fireplace"] },
  { key: "built_ins", label: "Built-ins", fields: ["built_ins"] },
  COMMON_COST,
];

export function sectionsFor(room_type: RoomSpec["room_type"]): Section[] {
  switch (variantForRoomType(room_type)) {
    case "kitchen":
      return KITCHEN_SECTIONS;
    case "bath":
      return BATH_SECTIONS;
    case "bedroom":
      return BEDROOM_SECTIONS;
    case "living":
      return LIVING_SECTIONS;
  }
}

/**
 * Per-variant one-line summarizer for the History dialog. Grabs a couple of
 * distinctive fields so the designer can eyeball versions. Intentionally
 * defensive against partial data.
 */
export function summarizeSpec(spec: RoomSpec): string {
  const parts: string[] = [];
  if (spec.room_type === "kitchen") {
    const color = spec.cabinetry?.color?.color_name;
    const counterMat = spec.counters?.material;
    if (color) parts.push(`${color} cabinets`);
    if (counterMat) parts.push(`${counterMat} counters`);
  } else if (variantForRoomType(spec.room_type) === "bath") {
    const bath = spec as Extract<RoomSpec, { room_type: "primary_bath" | "secondary_bath" | "powder" }>;
    const vanityColor = bath.vanity?.color?.color_name;
    const firstTile = bath.tile_surfaces?.[0]?.material;
    if (vanityColor) parts.push(`${vanityColor} vanity`);
    if (firstTile) parts.push(`${firstTile} tile`);
  } else {
    const wall = spec.paint?.walls?.color_name;
    if (wall) parts.push(`${wall} walls`);
  }
  const flooring = spec.flooring?.material;
  if (flooring && parts.length < 2) parts.push(`${flooring} floors`);
  return parts.length > 0 ? parts.join(" + ") : "unnamed";
}
