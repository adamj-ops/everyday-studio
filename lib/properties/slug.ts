/** URL/file-safe slug from a street address. */
export function slugifyAddress(address: string): string {
  const s = address
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s.length > 0 ? s : "property";
}

/** Snake-ish room type for filenames. */
export function slugifyRoomType(roomType: string): string {
  const s = roomType
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return s.length > 0 ? s : "room";
}
