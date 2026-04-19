import { z } from "zod";

export const BuyerPersonaEnum = z.enum([
  "first_time_homebuyer",
  "young_family",
  "young_professional",
  "downsizer",
  "luxury",
  "investor_rental",
]);
export type BuyerPersona = z.infer<typeof BuyerPersonaEnum>;

const BUYER_PERSONA_LABELS: Record<BuyerPersona, string> = {
  first_time_homebuyer: "First-time homebuyer",
  young_family: "Young family",
  young_professional: "Young professional",
  downsizer: "Downsizer",
  luxury: "Luxury",
  investor_rental: "Investor / rental",
};

export const BUYER_PERSONA_OPTIONS: ReadonlyArray<{ value: BuyerPersona; label: string }> =
  BuyerPersonaEnum.options.map((value) => ({ value, label: BUYER_PERSONA_LABELS[value] }));

export function buyerPersonaLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = BuyerPersonaEnum.safeParse(value);
  return parsed.success ? BUYER_PERSONA_LABELS[parsed.data] : value;
}
