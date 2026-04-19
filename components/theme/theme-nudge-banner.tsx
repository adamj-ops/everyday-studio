"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Session-scoped dismissal via sessionStorage. Banner disappears
 * permanently once a theme row exists (handled by parent rendering logic).
 */
export function ThemeNudgeBanner({ propertyId }: { propertyId: string }) {
  const storageKey = `theme-nudge-dismissed:${propertyId}`;
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const value = window.sessionStorage.getItem(storageKey);
      setDismissed(value === "1");
    } catch {
      setDismissed(false);
    }
    setHydrated(true);
  }, [storageKey]);

  if (!hydrated || dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3",
      )}
    >
      <div className="text-sm">
        <span className="font-medium text-foreground">Set project theme</span>
        <span className="ml-2 text-muted-foreground">
          to guide renders — budget tier and aesthetic flow into every room.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/properties/${propertyId}/theme`}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Set theme <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try {
              window.sessionStorage.setItem(storageKey, "1");
            } catch {
              // ignore
            }
            setDismissed(true);
          }}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
