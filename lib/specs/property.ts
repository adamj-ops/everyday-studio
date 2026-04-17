import { z } from "zod";
import { BuyerPersonaEnum, type BuyerPersona } from "./schema";

export const CreatePropertyInput = z.object({
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(80),
  state: z.string().length(2).default("MN"),
  zip: z.string().min(5).max(10),
  arv_estimate: z.number().nonnegative().nullable().optional(),
  buyer_persona: BuyerPersonaEnum.nullable().optional(),
});
export type CreatePropertyInput = z.infer<typeof CreatePropertyInput>;

export const PatchPropertyInput = z.object({
  address: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(80).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().min(5).max(10).optional(),
  arv_estimate: z.number().nonnegative().nullable().optional(),
  buyer_persona: BuyerPersonaEnum.nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});
export type PatchPropertyInput = z.infer<typeof PatchPropertyInput>;

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

export function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents);
}
