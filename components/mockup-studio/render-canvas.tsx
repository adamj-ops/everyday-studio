"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RenderCanvasProps = {
  roomId: string;
  initialRender: {
    id: string;
    status: string;
    signedUrl: string | null;
    createdAt: string;
  } | null;
  hasBasePhoto: boolean;
  hasLockedSpec: boolean;
};

export function RenderCanvas({
  initialRender,
  hasBasePhoto,
  hasLockedSpec,
}: RenderCanvasProps) {
  const [editInstruction, setEditInstruction] = useState("");

  const render = initialRender;
  const canGenerate = hasBasePhoto && hasLockedSpec;
  const canEdit = Boolean(render?.signedUrl);

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Render</p>
          <h2 className="text-sm font-medium">Mockup canvas</h2>
        </div>
        {render ? (
          <Badge variant={statusVariant(render.status)}>{statusLabel(render.status)}</Badge>
        ) : null}
      </header>

      <div
        className={cn(
          "relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/40",
          !render && "border-dashed",
        )}
      >
        {render?.signedUrl ? (
          <Image
            src={render.signedUrl}
            alt="Latest render"
            width={1024}
            height={768}
            unoptimized
            className="size-full object-contain"
          />
        ) : (
          <EmptyState canGenerate={canGenerate} hasBasePhoto={hasBasePhoto} hasLockedSpec={hasLockedSpec} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={!canGenerate}
          // TODO(session-6-step-3): wire to /api/render/generate
          aria-label="Generate mockup"
        >
          Generate mockup
        </Button>
        {!canGenerate ? (
          <span className="text-xs text-muted-foreground">
            {!hasLockedSpec
              ? "Save a spec version first."
              : "Upload a base photo for this room."}
          </span>
        ) : null}
      </div>

      <div className="border-t pt-3">
        <label htmlFor="edit-instruction" className="text-xs text-muted-foreground">
          Conversational edit
        </label>
        <div className="mt-1 flex flex-col gap-2">
          <Textarea
            id="edit-instruction"
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            disabled={!canEdit}
            placeholder={
              canEdit
                ? "e.g. Change the backsplash to vertical stack zellige."
                : "Generate a mockup first to unlock edits."
            }
            rows={2}
          />
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={!canEdit || editInstruction.trim().length === 0}
              // TODO(session-6-step-4): wire to /api/render/edit
            >
              Apply edit
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState({
  canGenerate,
  hasBasePhoto,
  hasLockedSpec,
}: {
  canGenerate: boolean;
  hasBasePhoto: boolean;
  hasLockedSpec: boolean;
}) {
  let hint = "Click Generate to produce a mockup from the locked spec.";
  if (!hasLockedSpec) hint = "This room has no saved spec yet.";
  else if (!hasBasePhoto) hint = "Upload a before-photo tagged to this room, then Generate.";
  else if (!canGenerate) hint = "Set up the room first, then Generate.";

  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
      <p>No render yet.</p>
      <p className="max-w-xs text-pretty text-xs">{hint}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "prompt_review":
      return "Reviewing prompt";
    case "rendering":
      return "Rendering";
    case "image_review":
      return "Reviewing image";
    case "complete":
      return "Complete";
    case "complete_qa_pending":
      return "QA pending";
    case "gated_by_opus":
      return "Prompt rejected";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "complete") return "default";
  if (status === "failed" || status === "gated_by_opus") return "destructive";
  if (status === "complete_qa_pending") return "outline";
  return "secondary";
}
