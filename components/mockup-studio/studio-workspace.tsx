"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { RoomBriefRow, ProjectThemeRow } from "@/lib/briefs/schema";
import type { RenderReviewOutput, PromptReviewOutput } from "@/lib/claude/prompts";
import { BriefSidebar } from "./brief-sidebar";
import { RenderCanvas } from "./render-canvas";
import { ReviewNotes } from "./review-notes";
import { MoodboardPanel, type MoodboardImageItem } from "./moodboard-panel";

type InitialRender = {
  id: string;
  status: string;
  signed_url: string | null;
  opus_verdict: string | null;
  opus_critiques_json: unknown;
  created_at: string;
} | null;

export type StudioWorkspaceProps = {
  brief: RoomBriefRow | null;
  projectTheme: ProjectThemeRow | null;
  roomType: string;
  roomLabel: string;
  propertyId: string;
  roomId: string;
  basePhotoId: string | null;
  moodboardImages: MoodboardImageItem[];
  initialRender: InitialRender;
};

type RenderState = {
  id: string;
  status: string;
  signedUrl: string | null;
  createdAt: string;
  imageReview: RenderReviewOutput | null;
  promptReview: PromptReviewOutput | null;
  errorMessage: string | null;
};

const TERMINAL_STATES = new Set([
  "complete",
  "complete_qa_pending",
  "failed",
  "gated_by_opus",
]);
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;

export function StudioWorkspace({
  brief,
  projectTheme,
  roomType,
  roomLabel,
  propertyId,
  roomId,
  basePhotoId,
  moodboardImages,
  initialRender,
}: StudioWorkspaceProps) {
  const hasBrief = brief !== null;
  const [render, setRender] = useState<RenderState | null>(
    initialRender ? toRenderState(initialRender) : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  const pollAbortRef = useRef<AbortController | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
    pollStartedAtRef.current = null;
  }, []);

  const fetchRenderOnce = useCallback(async (renderId: string) => {
    const res = await fetch(`/api/renders/${renderId}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status_fetch_failed: ${res.status}`);
    const body = await res.json();
    return body as {
      id: string;
      status: string;
      signed_url: string | null;
      opus_verdict: string | null;
      opus_critiques_json: unknown;
      created_at: string;
      error_message: string | null;
    };
  }, []);

  const applyRenderBody = useCallback(
    (body: Awaited<ReturnType<typeof fetchRenderOnce>>): RenderState => {
      const { imageReview, promptReview } = splitCritiques(body.opus_critiques_json);
      return {
        id: body.id,
        status: body.status,
        signedUrl: body.signed_url,
        createdAt: body.created_at,
        imageReview,
        promptReview,
        errorMessage: body.error_message,
      };
    },
    [],
  );

  const startPolling = useCallback(
    (renderId: string) => {
      stopPolling();
      const ctrl = new AbortController();
      pollAbortRef.current = ctrl;
      pollStartedAtRef.current = Date.now();
      setPollingTimedOut(false);

      const tick = async () => {
        if (ctrl.signal.aborted) return;
        try {
          const body = await fetchRenderOnce(renderId);
          if (ctrl.signal.aborted) return;
          setRender(applyRenderBody(body));
          if (TERMINAL_STATES.has(body.status)) {
            stopPolling();
            return;
          }
          if (
            pollStartedAtRef.current &&
            Date.now() - pollStartedAtRef.current > POLL_TIMEOUT_MS
          ) {
            setPollingTimedOut(true);
            stopPolling();
            return;
          }
          setTimeout(tick, POLL_INTERVAL_MS);
        } catch (err) {
          if (ctrl.signal.aborted) return;
          console.warn("[studio] poll error, retrying once", err);
          setTimeout(tick, POLL_INTERVAL_MS * 2);
        }
      };

      setTimeout(tick, POLL_INTERVAL_MS);
    },
    [applyRenderBody, fetchRenderOnce, stopPolling],
  );

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (!initialRender) return;
    if (TERMINAL_STATES.has(initialRender.status)) return;
    startPolling(initialRender.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onGenerate = useCallback(async () => {
    if (!hasBrief) {
      toast.error("Save a brief for this room before generating.");
      return;
    }
    if (!basePhotoId) {
      toast.error("Upload a base photo tagged to this room first.");
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/render/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          base_photo_id: basePhotoId,
          idempotency_key: idempotencyKey,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          typeof body.error === "string"
            ? `Generate failed: ${body.error}`
            : `Generate failed (${res.status})`,
        );
        return;
      }
      const body = (await res.json()) as { render_id: string };
      toast.success("Generating — polling for progress.");
      setRender({
        id: body.render_id,
        status: "pending",
        signedUrl: null,
        createdAt: new Date().toISOString(),
        imageReview: null,
        promptReview: null,
        errorMessage: null,
      });
      startPolling(body.render_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setSubmitting(false);
    }
  }, [hasBrief, basePhotoId, roomId, startPolling]);

  const onRefresh = useCallback(async () => {
    if (!render) return;
    try {
      const body = await fetchRenderOnce(render.id);
      setRender(applyRenderBody(body));
      setPollingTimedOut(false);
      if (!TERMINAL_STATES.has(body.status)) startPolling(render.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    }
  }, [render, fetchRenderOnce, applyRenderBody, startPolling]);

  const onRetriggerReview = useCallback(async () => {
    if (!render) return;
    try {
      const res = await fetch(`/api/renders/${render.id}/review`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          typeof body.error === "string"
            ? `Review failed: ${body.error}`
            : `Review failed (${res.status})`,
        );
        return;
      }
      toast.success("Opus image review refreshed.");
      const fresh = await fetchRenderOnce(render.id);
      setRender(applyRenderBody(fresh));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    }
  }, [render, fetchRenderOnce, applyRenderBody]);

  const canvasInitial = useMemo(() => {
    if (!render) return null;
    return {
      id: render.id,
      status: render.status,
      signedUrl: render.signedUrl,
      createdAt: render.createdAt,
    };
  }, [render]);

  return (
    <div className="grid h-[calc(100dvh-10rem)] grid-cols-12 gap-4">
      <div className="col-span-3 min-h-0">
        <BriefSidebar
          brief={brief}
          projectTheme={projectTheme}
          roomType={roomType}
          roomLabel={roomLabel}
          propertyId={propertyId}
          roomId={roomId}
        />
      </div>
      <div className="col-span-6 flex min-h-0 flex-col gap-4">
        <MoodboardPanel
          images={moodboardImages}
          briefHref={`/properties/${propertyId}/rooms/${roomId}/brief`}
        />
        <div className="min-h-0 flex-1">
          {!hasBrief ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Save a brief for this room before generating.
              </p>
              <p className="max-w-prose text-pretty">
                The brief carries the creative direction, moodboard references, and
                non-negotiables the renderer synthesizes into a Gemini prompt.
              </p>
              <Link
                href={`/properties/${propertyId}/rooms/${roomId}/brief`}
                className="text-sm underline-offset-4 hover:underline"
              >
                Open brief →
              </Link>
            </div>
          ) : (
            <RenderCanvas
              roomId={roomId}
              initialRender={canvasInitial}
              hasBasePhoto={Boolean(basePhotoId)}
              hasBrief={hasBrief}
              submitting={submitting}
              pollingTimedOut={pollingTimedOut}
              onGenerate={onGenerate}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
      <div className="col-span-3 min-h-0">
        <ReviewNotes
          status={render?.status ?? null}
          review={render?.imageReview ?? null}
          promptGated={
            render?.status === "gated_by_opus" && render.promptReview
              ? { issues: render.promptReview.issues }
              : null
          }
          canRetriggerReview={render?.status === "complete_qa_pending"}
          onRetriggerReview={onRetriggerReview}
        />
      </div>
    </div>
  );
}

function toRenderState(initial: NonNullable<InitialRender>): RenderState {
  const { imageReview, promptReview } = splitCritiques(initial.opus_critiques_json);
  return {
    id: initial.id,
    status: initial.status,
    signedUrl: initial.signed_url,
    createdAt: initial.created_at,
    imageReview,
    promptReview,
    errorMessage: null,
  };
}

function splitCritiques(critiques: unknown): {
  imageReview: RenderReviewOutput | null;
  promptReview: PromptReviewOutput | null;
} {
  if (!critiques || typeof critiques !== "object") {
    return { imageReview: null, promptReview: null };
  }
  const c = critiques as { kind?: string } & Record<string, unknown>;
  if (c.kind === "image_review") {
    return { imageReview: c as unknown as RenderReviewOutput, promptReview: null };
  }
  if (c.kind === "prompt_review") {
    return {
      imageReview: null,
      promptReview: {
        verdict: c.verdict as PromptReviewOutput["verdict"],
        issues: (c.issues as PromptReviewOutput["issues"]) ?? [],
        revised_prompt: (c.revised_prompt as string | null) ?? null,
      },
    };
  }
  return { imageReview: null, promptReview: null };
}
