"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RenderCanvasProps {
  roomId: string;
  initialRender: {
    id: string;
    status: string;
    signedUrl: string | null;
    createdAt: string;
  } | null;
  hasBasePhoto: boolean;
  hasBrief: boolean;
  submitting: boolean;
  editing: boolean;
  pollingTimedOut: boolean;
  onGenerate: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onApplyEdit: (instruction: string) => void | Promise<void>;
}

const IN_FLIGHT_STATES = new Set([
  "pending",
  "prompt_review",
  "rendering",
  "image_review",
]);

export function RenderCanvas({
  initialRender,
  hasBasePhoto,
  hasBrief,
  submitting,
  editing,
  pollingTimedOut,
  onGenerate,
  onRefresh,
  onApplyEdit,
}: RenderCanvasProps) {
  const [editInstruction, setEditInstruction] = useState("");
  const editInstructionId = useId();
  const render = initialRender;
  const inFlight =
    submitting ||
    editing ||
    Boolean(render && IN_FLIGHT_STATES.has(render.status));
  const canGenerate = hasBasePhoto && hasBrief && !inFlight;
  const canEdit =
    Boolean(render?.signedUrl) && !inFlight && render?.status !== "failed";

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Render</p>
          <h2 className="text-sm font-medium">Mockup canvas</h2>
        </div>
        {render ? (
          <Badge variant={statusVariant(render.status)}>
            {statusLabel(render.status)}
          </Badge>
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
            render={render}
            hasBasePhoto={hasBasePhoto}
            hasBrief={hasBrief}
          />
        )}

        {pollingTimedOut ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-background/90 px-3 py-2 text-xs">
            <span className="text-pretty">
              Render is taking unusually long. The pipeline keeps running
              server-side — refresh to check.
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
          aria-label={render ? "Regenerate mockup" : "Generate mockup"}
        >
          {submitting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
          {render ? "Regenerate mockup" : "Generate mockup"}
        </Button>
        {!canGenerate && !inFlight ? (
          <span className="text-xs text-muted-foreground">
            {!hasBrief
              ? "Save a brief for this room first."
              : "Upload a base photo tagged to this room."}
          </span>
        ) : null}
        {render?.status === "failed" ? (
          <span className="text-xs text-muted-foreground">
            Last attempt failed. Click Regenerate to retry.
          </span>
        ) : null}
      </div>

      <div className="border-t pt-3">
        <label
          htmlFor={editInstructionId}
          className="font-heading text-sm font-medium"
        >
          Conversational edit
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {canEdit
            ? "Change one thing at a time. The edit preserves everything else in the image."
            : render?.status === "failed"
              ? "Regenerate first, then you can apply targeted edits."
              : render
                ? "Generating… edits unlock when the render completes."
                : "Generate a mockup first to unlock edits."}
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            id={editInstructionId}
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            disabled={!canEdit}
            placeholder={
              canEdit
                ? "e.g. Remove the second refrigerator — there should be only one panel-ready fridge clad in cabinet panels."
                : "Waiting on a completed render…"
            }
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Edits create a new version — your original render is preserved.
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!canEdit || editInstruction.trim().length === 0}
              onClick={() => {
                const text = editInstruction.trim();
                if (!text) return;
                void onApplyEdit(text);
                setEditInstruction("");
              }}
            >
              {editing ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
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
        <StageDot
          active={isStageActive(status, "prompt")}
          done={isStagePast(status, "prompt")}
        />
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
        done
          ? "bg-foreground"
          : active
            ? "bg-foreground/70"
            : "bg-muted-foreground/40",
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
  render,
  hasBasePhoto,
  hasBrief,
}: {
  render: RenderCanvasProps["initialRender"];
  hasBasePhoto: boolean;
  hasBrief: boolean;
}) {
  let title = "No render yet.";
  let hint = "Click Generate to produce a mockup from the brief.";

  if (render?.status === "failed") {
    title = "The last render failed.";
    hint = "Click Regenerate to try again.";
  } else if (render?.status === "gated_by_opus") {
    title = "Opus rejected the prompt.";
    hint = "Review the notes on the right, then Regenerate.";
  } else if (!hasBrief) {
    hint = "This room has no saved brief yet.";
  } else if (!hasBasePhoto) {
    hint = "Upload a before-photo tagged to this room, then Generate.";
  }

  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
      <p>{title}</p>
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

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "complete") return "default";
  if (status === "failed" || status === "gated_by_opus") return "destructive";
  if (status === "complete_qa_pending") return "outline";
  return "secondary";
}
