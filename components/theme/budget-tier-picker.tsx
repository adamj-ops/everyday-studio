"use client";

import { cn } from "@/lib/utils";
import { BUDGET_TIER_OPTIONS, type BudgetTierKey } from "@/lib/briefs/themes";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function BudgetTierPicker({
  value,
  customNotes,
  onChange,
  onCustomNotesChange,
}: {
  value: BudgetTierKey | null;
  customNotes: string;
  onChange: (value: BudgetTierKey) => void;
  onCustomNotesChange: (notes: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Budget tier"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {BUDGET_TIER_OPTIONS.map((tier) => {
          const selected = value === tier.key;
          return (
            <button
              key={tier.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(tier.key)}
              className={cn(
                "group flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                "hover:border-foreground/20 hover:bg-muted/40",
                selected
                  ? "border-foreground bg-muted shadow-card"
                  : "border-border bg-card",
              )}
            >
              <span className="font-heading text-sm font-medium text-card-foreground">
                {tier.label}
              </span>
              <span className="text-pretty text-xs text-muted-foreground">
                {tier.description}
              </span>
            </button>
          );
        })}
      </div>

      {value === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="budget_custom_notes" className="text-sm">
            Custom budget notes
          </Label>
          <Textarea
            id="budget_custom_notes"
            value={customNotes}
            onChange={(e) => onCustomNotesChange(e.target.value)}
            placeholder="e.g. $250/sqft cabinets budget, splurge on the range, hold the line on flooring..."
            rows={3}
            className="resize-none"
          />
        </div>
      )}
    </div>
  );
}
