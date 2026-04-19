"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RoomBriefRow } from "@/lib/briefs/schema";

export function BriefHistoryDialog({
  roomId,
  onRestore,
}: {
  roomId: string;
  onRestore: (brief: RoomBriefRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<RoomBriefRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rooms/${roomId}/brief/history`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { versions: RoomBriefRow[] }) => {
        if (!cancelled) setVersions(body.versions);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, roomId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost">History</Button>} />
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Brief history</DialogTitle>
          <DialogDescription>
            Restore any prior version into the form. You can still edit before saving.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && versions && versions.length === 0 && (
          <p className="text-sm text-muted-foreground">No saved versions yet.</p>
        )}
        {!loading && versions && versions.length > 0 && (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="font-heading text-sm font-medium tabular-nums">
                    Version {v.version}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onRestore(v);
                    setOpen(false);
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
