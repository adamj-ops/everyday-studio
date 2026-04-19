"use client";

export type MoodboardImageItem = {
  storage_path: string;
  signed_url: string | null;
  category_label: string;
};

export function MoodboardPanel({ images }: { images: MoodboardImageItem[] }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Moodboard</p>
          <h2 className="text-sm font-medium">
            Inspiration images (read-only — edit in the brief)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{images.length}</p>
      </header>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No moodboard images attached. Upload references in the brief.
        </div>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img) => (
            <li key={img.storage_path} className="shrink-0">
              <div className="group relative overflow-hidden rounded-lg border border-border">
                <div className="relative size-20 bg-muted">
                  {img.signed_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img.signed_url}
                      alt={img.category_label}
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-0.5 text-left text-[10px]">
                  {img.category_label}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
