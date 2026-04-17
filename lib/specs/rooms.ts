import { z } from "zod";

export const RoomTypeEnum = z.enum([
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
]);
export type RoomType = z.infer<typeof RoomTypeEnum>;

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
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
};

export const ROOM_TYPE_OPTIONS: ReadonlyArray<{ value: RoomType; label: string }> =
  RoomTypeEnum.options.map((value) => ({ value, label: ROOM_TYPE_LABELS[value] }));

export function roomTypeLabel(value: string): string {
  const parsed = RoomTypeEnum.safeParse(value);
  return parsed.success ? ROOM_TYPE_LABELS[parsed.data] : value;
}

export const CreateRoomInput = z.object({
  property_id: z.string().uuid(),
  room_type: RoomTypeEnum,
  label: z.string().min(1).max(80),
});
export type CreateRoomInput = z.infer<typeof CreateRoomInput>;
