"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Category } from "@/lib/briefs/categories";

const MAX_IMAGES = 10;
const ACCEPT = "image/jpeg,image/png,image/webp";

export interface MoodboardTileState {
  image_storage_paths: string[];
  // storage_path -> signed display URL (expires). Kept in parent state so
  // uploads persist across re-renders of siblings.
  signed_urls: Record<string, string>;
  notes: string;
}

export function MoodboardCategoryTile({
  category,
  roomId,
  state,
  onChange,
}: {
  category: Category;
  roomId: string;
  state: MoodboardTileState;
  onChange: (next: MoodboardTileState) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const count = state.image_storage_paths.length;
  const atCap = count >= MAX_IMAGES;

  const uploadOne = async (file: File): Promise<void> => {
    if (atCap) {
      toast.error(`${category.label}: up to ${MAX_IMAGES} images per category.`);
      return;
    }

    const signRes = await fetch(`/api/rooms/${roomId}/moodboard/upload-sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category_key: category.key,
        filename: file.name,
        mime_type: file.type,
        size: file.size,
      }),
    });
    if (!signRes.ok) {
      const body = await signRes.json().catch(() => ({}));
      throw new Error(body?.error ?? "Upload sign failed");
    }
    const { storage_path, signed_url, token } = (await signRes.json()) as {
      storage_path: string;
      signed_url: string;
      token: string;
    };

    const putRes = await fetch(signed_url, {
      method: "PUT",
      headers: {
        "content-type": file.type,
        "x-upsert": "true",
        authorization: `Bearer ${token}`,
      },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed (${putRes.status})`);
    }

    let displayUrl: string | null = null;
    try {
      const signViewRes = await fetch(`/api/rooms/${roomId}/moodboard/sign-view`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths: [storage_path] }),
      });
      if (signViewRes.ok) {
        const body = (await signViewRes.json()) as { urls?: Record<string, string> };
        displayUrl = body.urls?.[storage_path] ?? null;
      }
    } catch {
      // non-fatal — preview tile will fall back to "image" label
    }

    onChange({
      ...state,
      image_storage_paths: [...state.image_storage_paths, storage_path],
      signed_urls: displayUrl
        ? { ...state.signed_urls, [storage_path]: displayUrl }
        : state.signed_urls,
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const remaining = Math.max(0, MAX_IMAGES - state.image_storage_paths.length);
    const toUpload = list.slice(0, remaining);
    if (list.length > remaining) {
      toast.error(
        `${category.label}: only ${remaining} slot${remaining === 1 ? "" : "s"} left.`,
      );
    }
    setIsUploading(true);
    for (const file of toUpload) {
      try {
        await uploadOne(file);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Upload failed for ${file.name}`,
        );
      }
    }
    setIsUploading(false);
  };

  const removeAt = (idx: number) => {
    const path = state.image_storage_paths[idx];
    const nextPaths = state.image_storage_paths.filter((_, i) => i !== idx);
    const nextUrls = { ...state.signed_urls };
    if (path) delete nextUrls[path];
    onChange({ ...state, image_storage_paths: nextPaths, signed_urls: nextUrls });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-heading text-sm font-medium text-card-foreground">
            {category.label}
          </div>
          <div className="text-pretty text-xs text-muted-foreground">
            {category.description}
          </div>
        </div>
        <Badge variant={count > 0 ? "default" : "outline"} className="tabular-nums">
          {count}/{MAX_IMAGES}
        </Badge>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (atCap) {
            toast.error(`${category.label}: already at ${MAX_IMAGES}.`);
            return;
          }
          if (e.dataTransfer.files.length > 0) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        disabled={atCap || isUploading}
        aria-label={`Upload moodboard images for ${category.label}`}
        className={cn(
          "flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors",
          dragActive ? "border-foreground bg-muted" : "border-border hover:bg-muted/40",
          atCap && "opacity-50",
        )}
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="size-4" aria-hidden="true" />
        )}
        <span className="text-muted-foreground">
          {atCap ? "Full" : isUploading ? "Uploading…" : "Drop or click to add"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {count > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.image_storage_paths.map((path, idx) => {
            const url = state.signed_urls[path];
            return (
              <div
                key={path}
                className="group relative size-16 overflow-hidden rounded-md border border-border bg-muted"
              >
                {url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={url}
                    alt={`${category.label} ${idx + 1}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                    image
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label={`Remove ${category.label} image ${idx + 1}`}
                  className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Textarea
        value={state.notes}
        onChange={(e) => onChange({ ...state, notes: e.target.value })}
        placeholder="Notes (optional) — e.g. unlacquered brass, matte finish…"
        rows={2}
        className="resize-none text-sm"
      />
    </div>
  );
}
