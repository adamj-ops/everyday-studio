"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import type {
  RenderReviewOutput,
  RenderReviewIssue,
  ReviewVerdict,
} from "@/lib/claude/prompts";

export type ReviewNotesProps = {
  status: string | null;
  review: RenderReviewOutput | null;
  promptGated: {
    issues: { severity: string; concern: string; suggestion: string }[];
  } | null;
  canRetriggerReview?: boolean;
  onRetriggerReview?: () => void | Promise<void>;
};

export function ReviewNotes({
  status,
  review,
  promptGated,
  canRetriggerReview = false,
  onRetriggerReview,
}: ReviewNotesProps) {
  if (promptGated) {
    return (
      <aside className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border p-4">
        <Header title="Prompt rejected by Opus" variant="destructive" />
        <p className="text-xs text-muted-foreground text-pretty">
          The prompt didn&apos;t pass the pre-render gate. Gemini was not called.
        </p>
        <ul className="space-y-2 text-xs">
          {promptGated.issues.map((issue, i) => (
            <li key={i} className="rounded-md border p-2">
              <div className="flex items-center gap-2">
                <SeverityDot severity={issue.severity as "high" | "medium" | "low"} />
                <span className="font-medium capitalize">{issue.severity}</span>
              </div>
              <p className="mt-1 text-foreground">{issue.concern}</p>
              <p className="mt-1 text-muted-foreground">→ {issue.suggestion}</p>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  if (!review) {
    return (
      <aside className="flex h-full flex-col gap-3 overflow-y-auto rounded-xl border p-4">
        <Header title="Review" />
        <p className="text-xs text-muted-foreground text-pretty">
          {emptyHint(status)}
        </p>
        {canRetriggerReview && onRetriggerReview ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void onRetriggerReview()}
            className="self-start"
          >
            <RefreshCcw className="mr-1 size-3" /> Re-run Opus review
          </Button>
        ) : null}
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Opus QA</p>
          <h2 className="text-sm font-medium">Image review</h2>
        </div>
        <VerdictBadge verdict={review.overall_match} />
      </header>

      <p className="text-xs text-pretty">{review.summary}</p>

      {review.issues.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Issues
          </h3>
          <ul className="space-y-2 text-xs">
            {review.issues.map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </ul>
        </section>
      ) : null}

      {review.preserved_elements_check.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Preserved elements
          </h3>
          <ul className="space-y-1 text-xs">
            {review.preserved_elements_check.map((el, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{el.element}</span>
                <Badge variant={el.preserved ? "secondary" : "destructive"}>
                  {el.preserved ? "preserved" : "drifted"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function IssueRow({ issue }: { issue: RenderReviewIssue }) {
  return (
    <li className="rounded-md border p-2">
      <div className="flex items-center gap-2">
        <SeverityDot severity={issue.severity} />
        <span className="font-medium">{issue.element}</span>
      </div>
      <p className="mt-1 text-muted-foreground">
        Expected: <span className="text-foreground">{issue.expected}</span>
      </p>
      <p className="text-muted-foreground">
        Observed: <span className="text-foreground">{issue.observed}</span>
      </p>
      <p className="mt-1 text-pretty text-muted-foreground">→ {issue.correction_hint}</p>
    </li>
  );
}

function SeverityDot({ severity }: { severity: "high" | "medium" | "low" }) {
  const color =
    severity === "high"
      ? "bg-destructive"
      : severity === "medium"
        ? "bg-amber-500"
        : "bg-muted-foreground/50";
  return <span className={`size-2 rounded-full ${color}`} aria-hidden />;
}

function VerdictBadge({ verdict }: { verdict: ReviewVerdict }) {
  if (verdict === "excellent" || verdict === "good") {
    return <Badge variant="default">{verdict}</Badge>;
  }
  if (verdict === "needs_correction") {
    return <Badge variant="outline">needs correction</Badge>;
  }
  return <Badge variant="destructive">{verdict}</Badge>;
}

function Header({
  title,
  variant,
}: {
  title: string;
  variant?: "destructive";
}) {
  return (
    <header>
      <p className="text-xs text-muted-foreground">
        {variant === "destructive" ? "Opus" : "Review"}
      </p>
      <h2 className="text-sm font-medium text-balance">{title}</h2>
    </header>
  );
}

function emptyHint(status: string | null): string {
  if (status === null) return "Generate a mockup to see the Opus review here.";
  if (status === "pending" || status === "prompt_review" || status === "rendering" || status === "image_review") {
    return "Review will appear when the render completes.";
  }
  if (status === "complete_qa_pending") {
    return "Render complete, but QA couldn't be produced — re-run from the canvas.";
  }
  if (status === "failed") return "Render failed. Try again.";
  return "";
}
