"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function NonNegotiables({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="non-negotiables" className="font-heading text-base font-medium">
        Non-negotiables
      </Label>
      <p className="text-pretty text-sm text-muted-foreground">
        What must appear. What must NOT appear. The renderer treats these as hard
        constraints.
      </p>
      <Textarea
        id="non-negotiables"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Must have unlacquered brass hardware. Must NOT be gray. Must preserve the original hardwood floors."
        rows={4}
        className="text-base"
      />
    </div>
  );
}
