"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_MOODBOARD_CATEGORY_KEYS, categoryLabelFromKey } from "@/lib/briefs/categories";
import { SPACE_TYPE_OPTIONS, spaceTypeLabel } from "@/lib/briefs/space-types";
import type { SavedReferenceRow } from "@/lib/favorites/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PAGE_SKELETON_IDS = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;

export function FavoritesClient() {
  const [items, setItems] = useState<SavedReferenceRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [editRow, setEditRow] = useState<SavedReferenceRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSpaceType, setEditSpaceType] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState<SavedReferenceRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (roomFilter !== "all") params.set("space_type", roomFilter);
      const qs = params.toString();
      const res = await fetch(qs ? `/api/favorites?${qs}` : "/api/favorites");
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
      toast.error(e instanceof Error ? e.message : "Could not load favorites");
      setItems([]);
      setUrls({});
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, roomFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (row: SavedReferenceRow) => {
    setEditRow(row);
    setEditLabel(row.label ?? "");
    setEditNotes(row.notes ?? "");
    setEditCategory(row.category);
    setEditSpaceType(row.space_type ?? "");
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/favorites/${editRow.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim() || null,
          notes: editNotes.trim() || null,
          category: editCategory,
          space_type: editSpaceType === "" ? null : editSpaceType,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Could not update");
      }
      toast.success("Favorite updated");
      setEditRow(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setEditSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteRow) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/favorites/${deleteRow.id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Could not delete");
      }
      toast.success("Removed from favorites");
      setDeleteRow(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const selectCls = cn(
    "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-balance font-heading text-2xl font-medium">Favorites</h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Saved moodboard references. Deleting here does not remove images from existing briefs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Category</span>
            <select
              className={selectCls}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All</option>
              {ALL_MOODBOARD_CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {categoryLabelFromKey(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Room</span>
            <select
              className={selectCls}
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              aria-label="Filter by room type"
            >
              <option value="all">All</option>
              {SPACE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_SKELETON_IDS.map((id) => (
            <div key={id} className="h-64 animate-pulse rounded-xl border border-border bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center shadow-card">
          <p className="text-balance font-heading text-lg font-medium">No favorites yet</p>
          <p className="max-w-md text-pretty text-sm text-muted-foreground">
            Upload a reference on a room brief, then use the star on the thumbnail to save it here.
            You can reuse favorites across properties without re-uploading.
          </p>
          <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
            Go to dashboard
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => {
            const url = urls[row.storage_path];
            return (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {url ? (
                    <Image
                      src={url}
                      alt=""
                      width={800}
                      height={600}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                      Preview unavailable
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="space-y-1">
                    <p className="line-clamp-2 text-sm font-medium text-card-foreground">
                      {row.label?.trim() || row.original_filename?.trim() || "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabelFromKey(row.category)}
                      {row.space_type ? ` · ${spaceTypeLabel(row.space_type)}` : ""}
                    </p>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDeleteRow(row)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-balance">Edit favorite</DialogTitle>
            <DialogDescription className="text-pretty">
              Update how this reference is labeled and organized.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Label</span>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Notes</span>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Category</span>
              <select
                className={cn(selectCls, "w-full")}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                aria-label="Category"
              >
                {ALL_MOODBOARD_CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {categoryLabelFromKey(k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Room type (optional)</span>
              <select
                className={cn(selectCls, "w-full")}
                value={editSpaceType}
                onChange={(e) => setEditSpaceType(e.target.value)}
                aria-label="Room type"
              >
                <option value="">Any room</option>
                {SPACE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={editSaving} onClick={() => void submitEdit()}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-balance">Remove favorite?</DialogTitle>
            <DialogDescription className="text-pretty">
              This removes the shortcut from your library only. Images already placed on briefs stay
              on those briefs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={() => void submitDelete()}
            >
              {deleteSubmitting ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
