import type { RoomType } from "./room-types";

export interface Category {
  key: string;
  label: string;
  description: string;
}

const BATH_CATEGORIES: Category[] = [
  { key: "vanity", label: "Vanity", description: "Vanity style, mirror, lighting above" },
  { key: "tile_surfaces", label: "Tile & Surfaces", description: "Floor tile, shower walls, niche" },
  { key: "shower_tub", label: "Shower & Tub", description: "Shower type, tub if any, glass" },
  { key: "fixtures_plumbing", label: "Fixtures & Plumbing", description: "Faucets, showerhead, hardware finish" },
  { key: "color_mood", label: "Color & Mood", description: "Paint, overall palette" },
  { key: "storage_details", label: "Storage & Details", description: "Medicine cabinet, towel bars, accents" },
];

const BEDROOM_CATEGORIES: Category[] = [
  { key: "walls_color", label: "Walls & Color", description: "Paint, wallpaper, accent wall" },
  { key: "flooring", label: "Flooring", description: "Floor material, pattern, rugs" },
  { key: "lighting", label: "Lighting", description: "Ceiling, lamps, sconces" },
  { key: "window_treatments", label: "Window Treatments", description: "Curtains, blinds, shades" },
  { key: "bed_nightstands", label: "Bed & Nightstands", description: "Bed style, headboard, nightstand" },
  { key: "color_mood", label: "Color & Mood", description: "Overall palette, mood, textiles" },
];

const LIVING_CATEGORIES: Category[] = [
  { key: "walls_color", label: "Walls & Color", description: "Paint, accent walls, trim" },
  { key: "flooring", label: "Flooring", description: "Floor material, area rugs" },
  { key: "lighting", label: "Lighting", description: "Ceiling, lamps, sconces" },
  { key: "fireplace_focal", label: "Fireplace & Focal", description: "Fireplace treatment, TV wall, built-ins" },
  { key: "furniture", label: "Furniture", description: "Sofa, chairs, coffee table" },
  { key: "color_mood", label: "Color & Mood", description: "Palette, textiles, accents" },
];

const DINING_CATEGORIES: Category[] = [
  { key: "walls_color", label: "Walls & Color", description: "Paint, wallpaper, wainscoting" },
  { key: "flooring", label: "Flooring", description: "Floor material, rug" },
  { key: "lighting", label: "Lighting", description: "Chandelier, pendants, sconces" },
  { key: "furniture", label: "Furniture", description: "Dining table, chairs, buffet" },
  { key: "color_mood", label: "Color & Mood", description: "Palette, textiles, accents" },
  { key: "window_details", label: "Window Treatments & Details", description: "Curtains, art, mirrors" },
];

const OTHER_CATEGORIES: Category[] = [
  { key: "walls_color", label: "Walls & Color", description: "Paint, treatment" },
  { key: "flooring", label: "Flooring", description: "Floor material" },
  { key: "lighting", label: "Lighting", description: "Fixtures" },
  { key: "details", label: "Details & Accents", description: "Everything else" },
];

export const CATEGORIES_BY_ROOM: Record<RoomType, Category[]> = {
  kitchen: [
    { key: "appliances", label: "Appliances", description: "Range, fridge, dishwasher, hood" },
    { key: "cabinetry", label: "Cabinetry", description: "Cabinet style, finish, hardware" },
    { key: "color_mood", label: "Color & Mood", description: "Paint, overall palette, lighting mood" },
    { key: "tile_countertops", label: "Tile & Countertops", description: "Backsplash, counter material, pattern" },
    { key: "flooring_trim", label: "Flooring & Trim", description: "Floor material, baseboard, molding" },
    { key: "fixtures_sink", label: "Fixtures & Sink", description: "Faucet, sink, lighting fixtures" },
  ],
  primary_bath: BATH_CATEGORIES,
  secondary_bath: BATH_CATEGORIES,
  powder: [
    { key: "vanity_sink", label: "Vanity & Sink", description: "Vanity or pedestal, sink style" },
    { key: "tile_surfaces", label: "Tile & Surfaces", description: "Floor, walls, wainscot" },
    { key: "fixtures", label: "Fixtures", description: "Faucet, hardware, lighting" },
    { key: "wall_treatment", label: "Wall Treatment", description: "Paint, wallpaper, detail" },
    { key: "mirror_details", label: "Mirror & Details", description: "Mirror, towel hooks, accents" },
  ],
  primary_bedroom: BEDROOM_CATEGORIES,
  secondary_bedroom: BEDROOM_CATEGORIES,
  living_room: LIVING_CATEGORIES,
  family_room: LIVING_CATEGORIES,
  dining_room: DINING_CATEGORIES,
  foyer: OTHER_CATEGORIES,
  hallway: OTHER_CATEGORIES,
  laundry: OTHER_CATEGORIES,
  office: OTHER_CATEGORIES,
};

export function categoriesForRoom(roomType: string): Category[] {
  if (roomType in CATEGORIES_BY_ROOM) {
    return CATEGORIES_BY_ROOM[roomType as RoomType];
  }
  return OTHER_CATEGORIES;
}

/** Resolve moodboard category label from persisted category_key. */
export function categoryLabelFromKey(key: string): string {
  for (const cats of Object.values(CATEGORIES_BY_ROOM)) {
    const c = cats.find((x) => x.key === key);
    if (c) return c.label;
  }
  return key;
}

export const ALL_MOODBOARD_CATEGORY_KEYS: string[] = Array.from(
  new Set(Object.values(CATEGORIES_BY_ROOM).flatMap((cats) => cats.map((c) => c.key))),
).sort((a, b) => a.localeCompare(b));
