"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { FieldContext } from "@/components/specs/field";

interface Props {
  fieldPath: string;
  context: FieldContext;
  onAccept: (value: unknown) => void;
}

interface SuggestResponse {
  suggested_value: unknown;
  reasoning: string;
  token_usage?: { input_tokens?: number; output_tokens?: number };
}

export function SuggestPopover({ fieldPath, context, onAccept }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchSuggestion() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/rooms/${context.roomId}/spec/suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_path: fieldPath,
            partial_spec: context.getPartialSpec(),
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `Request failed (${res.status})`);
        return;
      }
      setResult(body as SuggestResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !result && !loading) {
      void fetchSuggestion();
    }
    if (!next) {
      // Reset on close so next open re-fetches
      setResult(null);
      setError(null);
    }
  }

  function accept() {
    if (!result) return;
    onAccept(result.suggested_value);
    toast.success("Suggestion applied");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label={`Suggest a value for ${fieldPath}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Sparkles className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="text-xs text-muted-foreground">
          Suggesting <span className="font-mono">{fieldPath}</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Asking Sonnet…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {result && !loading ? (
          <>
            <div className="space-y-1">
              <div className="text-xs font-semibold">Suggested value</div>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(result.suggested_value, null, 2)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold">Why</div>
              <p className="text-xs text-muted-foreground">{result.reasoning}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={accept}>
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Dismiss
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
