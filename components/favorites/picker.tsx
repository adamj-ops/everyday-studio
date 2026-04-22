"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SavedReferenceRow } from "@/lib/favorites/types";

const PICKER_SKELETON_IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

export function FavoritesPicker({
  open,
  onOpenChange,
  categoryKey,
  roomType,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryKey: string;
  roomType: string;
  onPick: (storagePath: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SavedReferenceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams({ category: categoryKey, room_type: roomType });
      const res = await fetch(`/api/favorites?${qs.toString()}`);
      const body = (await res.json().catch(() => ({}))) as {
        favorites?: SavedReferenceRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Could not load favorites");
      }
      const list = body.favorites ?? [];
      setItems(list);
      if (list.length > 0) {
        const signRes = await fetch("/api/favorites/sign-view", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paths: list.map((f) => f.storage_path) }),
        });
        if (signRes.ok) {
          const signBody = (await signRes.json()) as { urls?: Record<string, string> };
          setUrls(signBody.urls ?? {});
        } else {
          setUrls({});
        }
      } else {
        setUrls({});
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load favorites");
      setItems([]);
      setUrls({});
    } finally {
      setLoading(false);
    }
  }, [categoryKey, roomType]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((f) => {
      const label = (f.label ?? "").toLowerCase();
      const notes = (f.notes ?? "").toLowerCase();
      return label.includes(q) || notes.includes(q);
    });
  }, [items, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,640px)] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-4 text-left">
          <DialogTitle className="text-balance">Use a favorite</DialogTitle>
          <DialogDescription className="text-pretty">
            References saved for this category. Selecting one adds it to this moodboard (same file,
            no duplicate upload).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-4">
          <Input
            type="search"
            placeholder="Filter by label…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter favorites by label"
            disabled={loading || items.length === 0}
          />
          {loadError ? (
            <p className="text-pretty text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : null}
          <div className="max-h-[min(50dvh,360px)] overflow-y-auto">
            {loading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {PICKER_SKELETON_IDS.map((id) => (
                  <div key={id} className="aspect-square animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-pretty text-sm text-muted-foreground">
                  {items.length === 0
                    ? "No favorites for this category yet. Save one from an uploaded image on the brief."
                    : "No matches. Try a different search."}
                </p>
                {items.length === 0 ? (
                  <Link
                    href="/favorites"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    View all favorites
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {filtered.map((f) => {
                  const url = urls[f.storage_path];
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick(f.storage_path);
                          onOpenChange(false);
                        }}
                        className="group flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                          {url ? (
                            <Image
                              src={url}
                              alt=""
                              width={120}
                              height={120}
                              unoptimized
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                              preview
                            </div>
                          )}
                        </div>
                        <span className="line-clamp-2 px-0.5 text-[11px] text-muted-foreground">
                          {f.label?.trim() || f.original_filename?.trim() || "Untitled"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {!loading && items.length > 0 ? (
            <div className="flex justify-end border-t border-border pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
                Refresh list
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
