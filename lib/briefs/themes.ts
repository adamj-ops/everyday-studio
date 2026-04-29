import type { SurfaceType } from "./schema";

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

export const interiorThemes = THEME_PRESETS;

export const facadeThemes: ReadonlyArray<ThemePreset> = [
  {
    key: "traditional",
    label: "Traditional",
    description:
      "Ground the facade in warm whites, muted charcoal, deep green, and historically plausible contrast. Favor painted lap siding, restored trim, divided-light windows, natural brick or stone, and restrained brass or black exterior hardware; references can lean Gil Schafer, Roman and Williams, and classic Minneapolis foursquare proportions.",
    image: "/themes/facade-traditional.svg",
  },
  {
    key: "modern_farmhouse",
    label: "Modern Farmhouse",
    description:
      "Use a crisp white, soft black, warm wood, and weathered metal palette without tipping into trend-heavy contrast. Materials should feel buildable: board-and-batten, standing-seam accents, simple porch posts, black-framed windows, and warm cedar at doors or soffits; references can include Studio McGee exterior restraint and modern rural vernacular.",
    image: "/themes/facade-modern-farmhouse.svg",
  },
  {
    key: "prairie_craftsman",
    label: "Prairie Craftsman",
    description:
      "Keep the palette earthy: olive, umber, clay, cream, deep bronze, and stained wood. Emphasize horizontal lines, generous trim, tapered columns, stone bases, bracket details, and natural shingles or lap siding; references can lean Greene and Greene, Frank Lloyd Wright prairie massing, and Twin Cities craftsman bungalows.",
    image: "/themes/facade-prairie-craftsman.svg",
  },
  {
    key: "midcentury_revival",
    label: "Midcentury Revival",
    description:
      "Use warm neutrals, charcoal, walnut tones, muted ochre, and restrained color blocking. Materials should include vertical siding, brick, breeze-block cues, simple fascia, low-profile lighting, and stained wood doors; references can include Eichler, Neutra, and modest 1950s Midwest ranch renovations.",
    image: "/themes/facade-midcentury-revival.svg",
  },
  {
    key: "contemporary_glass",
    label: "Contemporary Glass",
    description:
      "Work in graphite, warm white, clear glass, dark bronze, and natural wood so the facade feels refined rather than cold. Use large but structurally believable glazing, slim metal railings, smooth fiber-cement or stucco, stone planes, and concealed lighting; references can include Olson Kundig, Feldman Architecture, and Vipp Shelter-level restraint.",
    image: "/themes/facade-contemporary-glass.svg",
  },
];

export const hardscapeThemes: ReadonlyArray<ThemePreset> = [
  {
    key: "formal_symmetric",
    label: "Formal Symmetric",
    description:
      "Use limestone, charcoal, clipped green, and pale gravel tones in a balanced composition. Materials should be rectilinear and crisp: large-format pavers, aligned steps, low masonry walls, formal edging, and paired planters; references can lean Belgian courtyards, David Hicks geometry, and classic estate entries.",
    image: "/themes/hardscape-formal-symmetric.svg",
  },
  {
    key: "naturalistic",
    label: "Naturalistic",
    description:
      "Keep the palette weathered and low-contrast with buff stone, gravel, mossy green, and aged wood. Favor irregular flagstone, decomposed granite, fieldstone walls, stepping stones, and soft planted edges; references can include Piet Oudolf-adjacent paths and North Shore stonework.",
    image: "/themes/hardscape-naturalistic.svg",
  },
  {
    key: "modern_minimal",
    label: "Modern Minimal",
    description:
      "Use concrete, pale gray, blackened steel, and controlled green with very little ornament. Materials should be planar and quiet: poured concrete walks, large slab pavers, gravel joints, simple retaining planes, and integrated step lighting; references can include Andrea Cochran and contemporary California courtyards.",
    image: "/themes/hardscape-modern-minimal.svg",
  },
  {
    key: "traditional_walkway",
    label: "Traditional Walkway",
    description:
      "Use brick red, warm limestone, cream mortar, black metal, and evergreen accents. Materials should feel established: clay brick, bluestone, soldier-course edging, curved walks, porch steps, and classic railings; references can include old Minneapolis garden walks and English townhouse entries.",
    image: "/themes/hardscape-traditional-walkway.svg",
  },
  {
    key: "contemporary_pool_deck",
    label: "Contemporary Pool Deck",
    description:
      "Use pale stone, soft gray, clear water blue, warm wood, and matte black accents. Materials should be slip-aware and resort-clean: porcelain pavers, thermal bluestone, flush drains, low retaining edges, integrated loungers, and restrained lighting; references can include boutique hotel pool terraces and Marmol Radziner outdoor spaces.",
    image: "/themes/hardscape-contemporary-pool-deck.svg",
  },
];

export const landscapeThemes: ReadonlyArray<ThemePreset> = [
  {
    key: "english_cottage",
    label: "English Cottage",
    description:
      "Use soft greens, lavender, cream, rose, and weathered gray in layered drifts. Materials should feel romantic but maintained: mixed perennial borders, pea gravel paths, climbing vines, painted gates, and rustic edging; references can include Gertrude Jekyll, Bunny Mellon, and Cotswold cottage gardens.",
    image: "/themes/landscape-english-cottage.svg",
  },
  {
    key: "prairie_natural",
    label: "Prairie Natural",
    description:
      "Use native green, straw, rust, seedhead brown, and late-season gold. Materials should prioritize regional resilience: grasses, coneflower, rudbeckia, sedges, informal boulders, mulch or gravel paths, and pollinator-friendly massing; references can include Piet Oudolf and Midwest native prairie restoration.",
    image: "/themes/landscape-prairie-natural.svg",
  },
  {
    key: "japanese_zen",
    label: "Japanese Zen",
    description:
      "Use deep green, raked gravel, charcoal stone, warm wood, and restrained flowering accents. Materials should be quiet and asymmetrical: mossy groundcover, specimen maples, boulders, gravel fields, bamboo or cedar screening, and simple water elements; references can include Kyoto courtyard gardens and Shunmyo Masuno.",
    image: "/themes/landscape-japanese-zen.svg",
  },
  {
    key: "mediterranean",
    label: "Mediterranean",
    description:
      "Use chalky whites, terra cotta, olive green, dusty lavender, and sun-baked stone. Materials should tolerate heat and dryness: gravel, stucco walls, clay pots, rosemary, lavender, ornamental grasses, and olive-like silhouettes where regionally viable; references can include Spanish courtyards and Nicole de Vesian.",
    image: "/themes/landscape-mediterranean.svg",
  },
  {
    key: "modern_minimalist",
    label: "Modern Minimalist",
    description:
      "Use monochrome greens, pale gravel, charcoal, and one restrained accent color. Materials should be edited and massed: repeated grasses, clipped shrubs, concrete or steel edging, simple trees, and generous negative space; references can include Luciano Giubbilei and contemporary Scandinavian landscape design.",
    image: "/themes/landscape-modern-minimalist.svg",
  },
];

export const gardenThemes: ReadonlyArray<ThemePreset> = [
  {
    key: "kitchen_garden",
    label: "Kitchen Garden",
    description:
      "Use leafy greens, herb tones, terra cotta, weathered cedar, and galvanized metal. Materials should make harvesting obvious: raised beds, gravel paths, trellises, edible borders, labeled herbs, and practical irrigation; references can include potager gardens, Martha Stewart kitchen gardens, and modern homestead layouts.",
    image: "/themes/garden-kitchen-garden.svg",
  },
  {
    key: "pollinator",
    label: "Pollinator",
    description:
      "Use nectar-rich color in controlled masses: purple, gold, white, pink, and native green. Materials should support habitat: milkweed, coneflower, salvia, bee balm, grasses, shallow water, natural mulch, and no overly manicured plastic edging; references can include Doug Tallamy and Midwest pollinator corridors.",
    image: "/themes/garden-pollinator.svg",
  },
  {
    key: "formal_french",
    label: "Formal French",
    description:
      "Use clipped green, pale gravel, cream stone, lavender, and restrained seasonal color. Materials should be symmetrical and structured: boxwood-like hedging where hardy, parterre geometry, gravel walks, urns, espalier, and low masonry edges; references can include Villandry, Bunny Mellon, and compact courtyard parterres.",
    image: "/themes/garden-formal-french.svg",
  },
  {
    key: "woodland_natural",
    label: "Woodland Natural",
    description:
      "Use shade greens, bark brown, fern texture, soft white flowers, and mossy stone. Materials should feel like a cleaned-up woodland floor: ferns, hosta, sedges, understory shrubs, stepping stones, logs, and dappled-light planting; references can include naturalistic shade gardens and Northwoods understory palettes.",
    image: "/themes/garden-woodland-natural.svg",
  },
  {
    key: "container_urban",
    label: "Container Urban",
    description:
      "Use compact color with black, terra cotta, concrete, galvanized metal, and lush green. Materials should be movable and dense: large planters, trellised vines, herbs, annual color, small trees in containers, drip lines, and balcony-safe surfaces; references can include urban rooftop gardens and Terrain-style container groupings.",
    image: "/themes/garden-container-urban.svg",
  },
];

export function getThemesForSurface(surface: SurfaceType): ReadonlyArray<ThemePreset> {
  switch (surface) {
    case "interior_room":
      return interiorThemes;
    case "facade":
      return facadeThemes;
    case "hardscape":
      return hardscapeThemes;
    case "landscape":
      return landscapeThemes;
    case "garden":
      return gardenThemes;
  }
}

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
