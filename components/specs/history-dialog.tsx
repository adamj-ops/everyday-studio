"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { RoomSpecSchema, type RoomSpec } from "@/lib/specs/schema";
import { summarizeSpec } from "@/lib/specs/variant";

interface Version {
  id: string;
  version: number;
  created_at: string;
  spec_json: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  currentVersion: number | null;
  onRestore: (spec: RoomSpec) => void;
}

export function HistoryDialog({
  open,
  onOpenChange,
  roomId,
  currentVersion,
  onRestore,
}: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setVersions(null);
    fetch(`/api/rooms/${roomId}/spec`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          setError(body?.error ?? `Request failed (${res.status})`);
          return;
        }
        setVersions(body.versions ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "network error"))
      .finally(() => setLoading(false));
  }, [open, roomId]);

  function handleRestore(v: Version) {
    const parsed = RoomSpecSchema.safeParse(v.spec_json);
    if (!parsed.success) {
      setError(`v${v.version} does not parse against the current schema`);
      return;
    }
    onRestore(parsed.data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Spec history</DialogTitle>
          <DialogDescription>
            Restore a past version into the form. You still need to Save to
            create a new version.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading versions…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {versions && versions.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No saved versions yet. Save the current spec to create v1.
          </p>
        ) : null}

        {versions && versions.length > 0 ? (
          <ul className="divide-y divide-border">
            {versions.map((v) => {
              const parsed = RoomSpecSchema.safeParse(v.spec_json);
              const summary = parsed.success ? summarizeSpec(parsed.data) : "invalid spec";
              const isCurrent = v.version === currentVersion;
              return (
                <li
                  key={v.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      v{v.version}
                      {isCurrent ? (
                        <Badge variant="secondary">current</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()} · {summary}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(v)}
                    disabled={!parsed.success}
                  >
                    Restore
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
