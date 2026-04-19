import { roomTypeLabel } from "@/lib/briefs/room-types";

type Photo = {
  id: string;
  storage_path: string;
  room_label: string | null;
  uploaded_at: string;
};

type Room = {
  id: string;
  room_type: string;
  label: string;
};

type Props = {
  photos: Photo[];
  rooms: Room[];
  signedUrls: Record<string, string>;
};

type Group = {
  key: string;
  heading: string;
  photos: Photo[];
};

function groupPhotos(photos: Photo[], rooms: Room[]): Group[] {
  // Build heading lookup by label so "Kitchen" + "Kitchen" disambiguate into
  // the right group even if rooms share a label across types (which the
  // unique index on rooms prevents within a property, but the type safety is
  // cheap).
  const headingByLabel = new Map<string, string>();
  for (const r of rooms) {
    headingByLabel.set(r.label, `${roomTypeLabel(r.room_type)} — ${r.label}`);
  }

  const groups = new Map<string, Group>();
  const unassigned: Photo[] = [];

  for (const photo of photos) {
    if (!photo.room_label) {
      unassigned.push(photo);
      continue;
    }
    const existing = groups.get(photo.room_label);
    if (existing) {
      existing.photos.push(photo);
    } else {
      groups.set(photo.room_label, {
        key: photo.room_label,
        heading: headingByLabel.get(photo.room_label) ?? photo.room_label,
        photos: [photo],
      });
    }
  }

  const result = Array.from(groups.values()).sort((a, b) =>
    a.heading.localeCompare(b.heading),
  );
  if (unassigned.length > 0) {
    result.push({ key: "__unassigned__", heading: "Unassigned", photos: unassigned });
  }
  return result;
}

export function PhotoGrid({ photos, rooms, signedUrls }: Props) {
  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No photos yet. Use “Add photos” to upload before-photos and tag them by
          room.
        </p>
      </div>
    );
  }

  const groups = groupPhotos(photos, rooms);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="mb-3 text-sm font-medium">{group.heading}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.photos.map((p) => {
              const url = signedUrls[p.storage_path];
              return (
                <div
                  key={p.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={p.room_label ?? "property photo"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Unavailable
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
