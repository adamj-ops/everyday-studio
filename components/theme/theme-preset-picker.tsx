"use client";

import { cn } from "@/lib/utils";
import { THEME_PRESETS } from "@/lib/briefs/themes";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type PresetValue = string | null | "custom";

export function ThemePresetPicker({
  value,
  customDescription,
  onChange,
  onCustomDescriptionChange,
}: {
  value: PresetValue;
  customDescription: string;
  onChange: (value: PresetValue) => void;
  onCustomDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Theme preset"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {THEME_PRESETS.map((preset) => {
          const selected = value === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(preset.key)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border text-left transition-colors",
                selected
                  ? "border-foreground shadow-card"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preset.image}
                  alt={preset.label}
                  className={cn(
                    "h-full w-full object-cover transition-opacity",
                    selected ? "opacity-100" : "opacity-90 group-hover:opacity-100",
                  )}
                />
              </div>
              <div className="flex flex-col gap-1 p-3">
                <span className="font-heading text-sm font-medium text-card-foreground">
                  {preset.label}
                </span>
                <span className="text-pretty text-xs text-muted-foreground">
                  {preset.description}
                </span>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          role="radio"
          aria-checked={value === "custom"}
          onClick={() => onChange("custom")}
          className={cn(
            "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border text-center transition-colors",
            value === "custom"
              ? "border-foreground bg-muted shadow-card"
              : "border-dashed border-border hover:border-foreground/30 hover:bg-muted/40",
          )}
        >
          <span className="font-heading text-sm font-medium">Custom</span>
          <span className="max-w-[16ch] text-pretty text-xs text-muted-foreground">
            Write your own aesthetic direction
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={cn(
            "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border text-center transition-colors",
            value === null
              ? "border-foreground bg-muted shadow-card"
              : "border-dashed border-border hover:border-foreground/30 hover:bg-muted/40",
          )}
        >
          <span className="font-heading text-sm font-medium">None</span>
          <span className="max-w-[16ch] text-pretty text-xs text-muted-foreground">
            Skip the aesthetic constraint
          </span>
        </button>
      </div>

      {value === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="theme_custom_description" className="text-sm">
            Custom aesthetic description
          </Label>
          <Textarea
            id="theme_custom_description"
            value={customDescription}
            onChange={(e) => onCustomDescriptionChange(e.target.value)}
            placeholder="e.g. Belgian farmhouse meets 60s California — limewash walls, antique wood, brass, linen..."
            rows={3}
            className="resize-none"
          />
        </div>
      )}
    </div>
  );
}
