"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export type ReferenceItem = {
  id: string;
  label: string;
  storage_path: string;
  signed_url: string | null;
  scope: "property" | "room";
};

export type ReferencesPanelProps = {
  references: ReferenceItem[];
  maxSelected?: number;
};

export function ReferencesPanel({ references, maxSelected = 4 }: ReferencesPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelected) {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="rounded-xl border p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">References</p>
          <h2 className="text-sm font-medium">
            Material &amp; inspiration images
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {selected.size} / {maxSelected} selected
        </p>
      </header>

      {references.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No references yet. Upload zellige, brass, flooring, or inspiration images to steer
          the render.
          <br />
          <span className="text-[11px]">Upload UI ships in step 5.</span>
        </div>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {references.map((ref) => {
            const isSelected = selected.has(ref.id);
            const canSelect = isSelected || selected.size < maxSelected;
            return (
              <li key={ref.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => toggle(ref.id)}
                  disabled={!canSelect}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Deselect" : "Select"} reference ${ref.label}`}
                  className={`group relative overflow-hidden rounded-lg border transition-opacity ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/50"
                      : "border-border"
                  } ${!canSelect ? "opacity-40" : "hover:opacity-90"}`}
                >
                  <div className="relative size-20 bg-muted">
                    {ref.signed_url ? (
                      <Image
                        src={ref.signed_url}
                        alt={ref.label}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-0.5 text-[10px] text-left">
                    {ref.label}
                  </div>
                  {ref.scope === "room" ? (
                    <Badge
                      variant="outline"
                      className="absolute right-1 top-1 border-background bg-background/85 text-[9px]"
                    >
                      room
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
