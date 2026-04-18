import type { PropertyContext, RoomSpec } from "../specs/schema";
import { deriveBudgetTier } from "../specs/schema";

/**
 * Spec Builder — field-level suggestion prompt.
 *
 * Powers the "✨ Suggest" button on every field in the room spec form.
 * Given the property context and any fields already filled in, Claude
 * suggests a value for the requested field in the structured shape.
 */

export interface SuggestionRequest {
  context: PropertyContext;
  room_type: RoomSpec["room_type"];
  room_name: string;
  field_path: string; // e.g., "cabinetry.color" or "counters.material"
  partial_spec: Record<string, unknown>; // whatever's filled in so far
}

/**
 * The envelope Sonnet returns for every field suggestion. suggested_value is
 * the field-shaped JSON; reasoning is a 1-2 sentence explanation the UI shows
 * in the Suggest popover before the designer accepts.
 */
export interface SuggestionOutput {
  suggested_value: unknown;
  reasoning: string;
}

export function buildSuggestFieldRequest(args: SuggestionRequest): {
  system: string;
  user: string;
} {
  const tier = deriveBudgetTier(args.context);

  const system = `You are the design assistant for Everyday Studio. You suggest specific product, material, color, and fixture choices for residential fix-and-flip renovations, calibrated to the property's buyer persona and budget tier.

Your suggestions are:
  - Specific (real product names, real paint codes, real finishes)
  - Cohesive with whatever spec fields are already locked in
  - Calibrated to the budget tier (don't suggest Ferguson Rohl on a builder-tier flip)
  - Biased toward reliable, easily-sourced products from suppliers the user has accounts with: Home Depot, Ferguson, Sherwin-Williams, Rejuvenation, Schoolhouse

BUDGET TIER GUIDANCE:
  - builder: Home Depot / Menards / Lowe's only. Sub-$200 faucets. LVP flooring. Standard white paint.
  - mid: Home Depot premium tiers + mid-range Ferguson. $200–500 faucets. Engineered hardwood or premium LVP. Sherwin-Williams named colors.
  - high: Ferguson mid-range, Rejuvenation, Schoolhouse. $400–800 faucets. Real hardwood, zellige, quartz. Designer paint colors.
  - luxury: Ferguson premium, unlacquered brass, marble, custom cabinetry. Skip if unsure — designer will override.

BUYER PERSONA GUIDANCE:
  - young_family: durable, warm, timeless. Avoid trends that date fast.
  - young_professional: modern, sleek, slightly editorial.
  - first_time_homebuyer: neutral, safe, broadly appealing.
  - downsizer: refined, low-maintenance, traditional-transitional.
  - luxury: statement materials, high-end finishes, editorial.
  - investor_rental: indestructible, neutral, zero-maintenance.

OUTPUT CONTRACT:
You must respond with ONLY a valid JSON object matching this exact envelope shape, no preamble, no markdown:
{
  "suggested_value": <the field-shaped value>,
  "reasoning": <string, 1–2 sentences explaining why this choice fits the spec, budget tier, and buyer persona>
}

The value inside "suggested_value" MUST match the schema shape of the requested field path exactly:
  - For a scalar field (e.g., "paint.walls.color_name"), suggested_value is a string/number/boolean.
  - For an object field (e.g., "paint.walls"), suggested_value is the object with all required sub-fields.
  - For an array field (e.g., "appliances"), suggested_value is an array of items matching that element's schema.

The reasoning should be short and concrete: name the specific reason (budget fit, cohesion with already-specified fields, buyer persona bias, supplier availability). Never repeat the value itself in the reasoning.`;

  const user = `PROPERTY
  Address: ${args.context.address}
  ARV: $${args.context.arv.toLocaleString()}
  Rehab budget: $${args.context.rehab_budget.toLocaleString()}
  Budget tier: ${tier}
  Buyer persona: ${args.context.buyer_persona.replace(/_/g, " ")}
  Neighborhood: ${args.context.neighborhood_notes ?? "n/a"}
  Style direction: ${args.context.style_direction ?? "none set yet"}

ROOM
  Name: ${args.room_name}
  Type: ${args.room_type}

ALREADY SPECIFIED (for cohesion):
${JSON.stringify(args.partial_spec, null, 2)}

FIELD TO SUGGEST: ${args.field_path}

Return a JSON object matching the schema for this field. Include real product names, real SKUs where known, real supplier routing. Leave supplier_url as null if you aren't certain of the exact URL.`;

  return { system, user };
}
