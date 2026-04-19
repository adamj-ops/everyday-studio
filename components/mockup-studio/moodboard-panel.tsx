"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type MoodboardImageItem = {
  storage_path: string;
  signed_url: string | null;
  category_label: string;
};

export function MoodboardPanel({
  images,
  briefHref,
}: {
  images: MoodboardImageItem[];
  briefHref: string;
}) {
  return (
    <section className="rounded-xl border border-border p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Moodboard</p>
          <h2 className="text-sm font-medium">
            Inspiration images (read-only — edit in the brief)
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="tabular-nums text-muted-foreground">{images.length}</span>
          <Link
            href={briefHref}
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            {images.length === 0 ? "Add images" : "Edit brief"}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {images.length === 0 ? (
        <Link
          href={briefHref}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground"
        >
          No moodboard images yet — upload inspiration per category in the brief
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
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
