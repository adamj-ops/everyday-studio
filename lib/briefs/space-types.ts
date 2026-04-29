import { z } from "zod";

export const SpaceTypeEnum = z.enum([
  "kitchen",
  "primary_bath",
  "secondary_bath",
  "powder",
  "primary_bedroom",
  "secondary_bedroom",
  "living_room",
  "family_room",
  "dining_room",
  "foyer",
  "hallway",
  "laundry",
  "office",
  "facade",
  "hardscape",
  "landscape",
  "garden",
]);
export type SpaceType = z.infer<typeof SpaceTypeEnum>;

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  kitchen: "Kitchen",
  primary_bath: "Primary bath",
  secondary_bath: "Secondary bath",
  powder: "Powder room",
  primary_bedroom: "Primary bedroom",
  secondary_bedroom: "Secondary bedroom",
  living_room: "Living room",
  family_room: "Family room",
  dining_room: "Dining room",
  foyer: "Foyer",
  hallway: "Hallway",
  laundry: "Laundry",
  office: "Office",
  facade: "Facade",
  hardscape: "Hardscape",
  landscape: "Landscape",
  garden: "Garden",
};

export const SPACE_TYPE_OPTIONS: ReadonlyArray<{ value: SpaceType; label: string }> =
  SpaceTypeEnum.options.map((value) => ({ value, label: SPACE_TYPE_LABELS[value] }));

export function spaceTypeLabel(value: string): string {
  const parsed = SpaceTypeEnum.safeParse(value);
  return parsed.success ? SPACE_TYPE_LABELS[parsed.data] : value;
}

export const CreateSpaceInput = z.object({
  property_id: z.string().uuid(),
  space_type: SpaceTypeEnum,
  label: z.string().min(1).max(80),
});
export type CreateSpaceInput = z.infer<typeof CreateSpaceInput>;
