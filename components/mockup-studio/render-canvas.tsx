"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCcw } from "lucide-react";
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
  submitting: boolean;
  pollingTimedOut: boolean;
  onGenerate: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
};

const IN_FLIGHT_STATES = new Set([
  "pending",
  "prompt_review",
  "rendering",
  "image_review",
]);

export function RenderCanvas({
  initialRender,
  hasBasePhoto,
  hasLockedSpec,
  submitting,
  pollingTimedOut,
  onGenerate,
  onRefresh,
}: RenderCanvasProps) {
  const [editInstruction, setEditInstruction] = useState("");

  const render = initialRender;
  const inFlight =
    submitting || Boolean(render && IN_FLIGHT_STATES.has(render.status));
  const canGenerate = hasBasePhoto && hasLockedSpec && !inFlight;
  const canEdit = Boolean(render?.signedUrl) && !inFlight;

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
        ) : inFlight ? (
          <PipelineSkeleton status={render?.status ?? "pending"} />
        ) : (
          <EmptyState
            canGenerate={canGenerate}
            hasBasePhoto={hasBasePhoto}
            hasLockedSpec={hasLockedSpec}
          />
        )}

        {pollingTimedOut ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-background/90 px-3 py-2 text-xs">
            <span className="text-pretty">
              Render is taking unusually long. The pipeline keeps running server-side — refresh to check.
            </span>
            <Button size="sm" variant="outline" onClick={() => void onRefresh()}>
              <RefreshCcw className="mr-1 size-3" /> Refresh
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={!canGenerate}
          onClick={() => void onGenerate()}
          aria-label="Generate mockup"
        >
          {submitting ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : null}
          {render ? "Regenerate mockup" : "Generate mockup"}
        </Button>
        {!canGenerate && !inFlight ? (
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

function PipelineSkeleton({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <p>{stageLabel(status)}</p>
      <div className="flex items-center gap-1.5">
        <StageDot active={isStageActive(status, "prompt")} done={isStagePast(status, "prompt")} />
        <StageDot
          active={isStageActive(status, "render")}
          done={isStagePast(status, "render")}
        />
        <StageDot
          active={isStageActive(status, "qa")}
          done={isStagePast(status, "qa")}
        />
      </div>
      <p className="text-xs">Typically 45–90s end-to-end.</p>
    </div>
  );
}

function StageDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 rounded-full",
        done ? "bg-foreground" : active ? "bg-foreground/70" : "bg-muted-foreground/40",
      )}
    />
  );
}

function isStageActive(status: string, stage: "prompt" | "render" | "qa"): boolean {
  if (stage === "prompt") return status === "pending" || status === "prompt_review";
  if (stage === "render") return status === "rendering";
  return status === "image_review";
}

function isStagePast(status: string, stage: "prompt" | "render" | "qa"): boolean {
  if (stage === "prompt") return status === "rendering" || status === "image_review";
  if (stage === "render") return status === "image_review";
  return false;
}

function stageLabel(status: string): string {
  switch (status) {
    case "pending":
    case "prompt_review":
      return "Reviewing prompt with Opus…";
    case "rendering":
      return "Gemini is rendering the mockup…";
    case "image_review":
      return "Opus is reviewing the render…";
    default:
      return "Working…";
  }
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
