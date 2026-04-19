"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROOM_TYPE_OPTIONS, type RoomType } from "@/lib/briefs/room-types";
import { createClient } from "@/lib/supabase/client";

type FileStatus = "pending" | "uploading" | "done" | "failed";

type FileEntry = {
  id: string;
  file: File;
  previewUrl: string;
  roomType: RoomType | "";
  roomLabel: string;
  status: FileStatus;
  error?: string;
};

type Props = {
  propertyId: string;
};

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

function defaultLabelForType(roomType: RoomType): string {
  const opt = ROOM_TYPE_OPTIONS.find((o) => o.value === roomType);
  return opt?.label ?? roomType;
}

export function PhotoUploadSheet({ propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const canUpload = useMemo(() => {
    if (entries.length === 0) return false;
    return entries.every(
      (e) =>
        e.status !== "uploading" &&
        e.roomType !== "" &&
        e.roomLabel.trim().length > 0,
    );
  }, [entries]);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const nextEntries: FileEntry[] = [];
      for (const file of incoming) {
        if (!ALLOWED_MIME.has(file.type)) {
          toast.error(`${file.name} — only jpg/png/webp accepted`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} — max size is 10 MB`);
          continue;
        }
        nextEntries.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          roomType: "",
          roomLabel: "",
          status: "pending",
        });
      }
      setEntries((prev) => {
        const combined = [...prev, ...nextEntries];
        if (combined.length > MAX_FILES) {
          toast.error(`Max ${MAX_FILES} files per batch. Extras dropped.`);
          return combined.slice(0, MAX_FILES);
        }
        return combined;
      });
    },
    [],
  );

  function removeEntry(id: string) {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function onTypeChange(id: string, value: string) {
    if (value === "") {
      updateEntry(id, { roomType: "", roomLabel: "" });
      return;
    }
    const rt = value as RoomType;
    const entry = entries.find((e) => e.id === id);
    // Seed the label with the friendly type name only if the user hasn't
    // typed their own label yet.
    updateEntry(id, {
      roomType: rt,
      roomLabel:
        entry?.roomLabel && entry.roomLabel.trim().length > 0
          ? entry.roomLabel
          : defaultLabelForType(rt),
    });
  }

  async function uploadAll() {
    if (entries.length === 0) return;

    setUploading(true);
    try {
      // Step 1: ask server for signed upload URLs (one per file).
      const signResponse = await fetch(
        `/api/properties/${propertyId}/photos/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: entries.map((e) => ({
              filename: e.file.name,
              mime_type: e.file.type,
              size: e.file.size,
            })),
          }),
        },
      );
      if (!signResponse.ok) {
        const err = await signResponse.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to get upload URLs");
      }
      const { uploads } = (await signResponse.json()) as {
        uploads: Array<{ filename: string; storage_path: string; token: string }>;
      };
      if (uploads.length !== entries.length) {
        throw new Error("Upload URL count mismatch");
      }

      // Step 2: upload each file directly to Storage using the signed token.
      // Do this sequentially so the UI progress is legible; for 20 files
      // on residential upload speeds the serial cost is tolerable.
      const supabase = createClient();
      const finalized: Array<{
        storage_path: string;
        room_type: RoomType;
        room_label: string;
      }> = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        const upload = uploads[i]!;
        updateEntry(entry.id, { status: "uploading" });
        const { error } = await supabase.storage
          .from("property-photos")
          .uploadToSignedUrl(upload.storage_path, upload.token, entry.file, {
            contentType: entry.file.type,
          });
        if (error) {
          updateEntry(entry.id, { status: "failed", error: error.message });
          toast.error(`Failed to upload ${entry.file.name} — try again`);
          continue;
        }
        updateEntry(entry.id, { status: "done" });
        finalized.push({
          storage_path: upload.storage_path,
          room_type: entry.roomType as RoomType,
          room_label: entry.roomLabel.trim(),
        });
      }

      if (finalized.length === 0) {
        throw new Error("No files uploaded successfully");
      }

      // Step 3: finalize — create rooms + property_photos rows.
      const finalizeResponse = await fetch(
        `/api/properties/${propertyId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: finalized }),
        },
      );
      if (!finalizeResponse.ok) {
        const err = await finalizeResponse.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save photos");
      }

      toast.success(`Uploaded ${finalized.length} photo${finalized.length === 1 ? "" : "s"}`);
      // Clear and refresh.
      entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
      setEntries([]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dropRef.current?.removeAttribute("data-drag");
    if (!event.dataTransfer.files) return;
    addFiles(event.dataTransfer.files);
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dropRef.current?.setAttribute("data-drag", "true");
  }

  function onDragLeave() {
    dropRef.current?.removeAttribute("data-drag");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="default" size="sm">
            <ImagePlus />
            Add photos
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>Add photos</SheetTitle>
          <SheetDescription>
            Drag in before-photos, tag each by room, and upload. Max {MAX_FILES}{" "}
            files, 10&nbsp;MB each, jpg/png/webp.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className="rounded-xl border border-dashed px-4 py-8 text-center transition-colors data-[drag=true]:bg-muted/60"
          >
            <p className="text-sm text-muted-foreground">
              Drop images here, or{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => inputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {entries.length > 0 && (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex gap-3 rounded-lg border p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.previewUrl}
                    alt={entry.file.name}
                    className="h-20 w-20 flex-none rounded-md object-cover bg-muted"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {entry.file.name}
                      </p>
                      <StatusBadge status={entry.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label
                          htmlFor={`room-type-${entry.id}`}
                          className="text-xs"
                        >
                          Room type
                        </Label>
                        <select
                          id={`room-type-${entry.id}`}
                          value={entry.roomType}
                          onChange={(e) => onTypeChange(entry.id, e.target.value)}
                          disabled={uploading}
                          className="mt-1 flex h-8 w-full items-center rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        >
                          <option value="">Select…</option>
                          {ROOM_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label
                          htmlFor={`room-label-${entry.id}`}
                          className="text-xs"
                        >
                          Label
                        </Label>
                        <Input
                          id={`room-label-${entry.id}`}
                          value={entry.roomLabel}
                          onChange={(e) =>
                            updateEntry(entry.id, { roomLabel: e.target.value })
                          }
                          placeholder="e.g. Kitchen, Upstairs bath"
                          disabled={uploading}
                          className="mt-1 h-8"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    disabled={uploading}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {entries.length} / {MAX_FILES} files
          </p>
          <Button
            onClick={uploadAll}
            disabled={!canUpload || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" />
                Uploading…
              </>
            ) : (
              `Upload all`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status: FileStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="size-3" /> Done
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="size-3" /> Failed
      </span>
    );
  }
  if (status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Uploading
      </span>
    );
  }
  return null;
}
