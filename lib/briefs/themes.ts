export interface ThemePreset {
  key: string;
  label: string;
  description: string;
  image: string;
}

export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  {
    key: "japandi",
    label: "Japandi",
    description: "Quiet, restrained, natural wood and negative space.",
    image: "/themes/japandi.svg",
  },
  {
    key: "scandinavian",
    label: "Scandinavian",
    description: "Bright, airy, pale woods and clean lines.",
    image: "/themes/scandinavian.svg",
  },
  {
    key: "modern_farmhouse",
    label: "Modern Farmhouse",
    description: "Warm whites, shiplap, black hardware, rustic wood.",
    image: "/themes/modern_farmhouse.svg",
  },
  {
    key: "craftsman",
    label: "Craftsman",
    description: "Stained wood, built-ins, earthy palette, honest materials.",
    image: "/themes/craftsman.svg",
  },
  {
    key: "mid_century_modern",
    label: "Mid-Century Modern",
    description: "Walnut, warm brass, clean geometry, 60s warmth.",
    image: "/themes/mid_century_modern.svg",
  },
  {
    key: "organic_modern",
    label: "Organic Modern",
    description: "Plaster, travertine, sculptural curves, neutral warmth.",
    image: "/themes/organic_modern.svg",
  },
  {
    key: "traditional",
    label: "Traditional",
    description: "Millwork, moldings, classic proportions, timeless.",
    image: "/themes/traditional.svg",
  },
  {
    key: "transitional",
    label: "Transitional",
    description: "Traditional bones with contemporary edits.",
    image: "/themes/transitional.svg",
  },
  {
    key: "coastal",
    label: "Coastal",
    description: "Washed woods, soft blues, linen, easy light.",
    image: "/themes/coastal.svg",
  },
  {
    key: "industrial",
    label: "Industrial",
    description: "Steel, brick, concrete, exposed structure.",
    image: "/themes/industrial.svg",
  },
];

export function themePresetLabel(key: string | null | undefined): string {
  if (!key) return "No preset";
  if (key === "custom") return "Custom";
  const preset = THEME_PRESETS.find((p) => p.key === key);
  return preset ? preset.label : key;
}

export const BUDGET_TIER_OPTIONS = [
  {
    key: "builder_grade",
    label: "Builder Grade",
    description: "Investor rental, $100–200/sqft finishes, durability priority",
  },
  {
    key: "mid_tier",
    label: "Mid-Tier",
    description: "$300–400/sqft flip, good materials, broad buyer appeal",
  },
  {
    key: "high_end",
    label: "High-End",
    description: "$500–700/sqft, designer-level materials, specific buyer",
  },
  {
    key: "luxury",
    label: "Luxury",
    description: "$700+/sqft, bespoke, no compromises",
  },
  {
    key: "custom",
    label: "Custom",
    description: "Write your own",
  },
] as const;

export type BudgetTierKey = (typeof BUDGET_TIER_OPTIONS)[number]["key"];

export function budgetTierLabel(key: string | null | undefined): string {
  if (!key) return "—";
  const tier = BUDGET_TIER_OPTIONS.find((t) => t.key === key);
  return tier ? tier.label : key;
}
