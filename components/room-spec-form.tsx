"use client";

import { useRouter } from "next/navigation";
import { useReducer, useState } from "react";
import { toast } from "sonner";
import { History as HistoryIcon, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VariantForm } from "@/components/specs/variant-form";
import { HistoryDialog } from "@/components/specs/history-dialog";
import type { FieldContext } from "@/components/specs/field";
import { RoomSpecSchema, type RoomSpec } from "@/lib/specs/schema";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FormState {
  spec: RoomSpec;
  isDirty: boolean;
  errors: Record<string, string[]>;
  saving: boolean;
}

type Action =
  | { type: "SET_FIELD"; path: string; value: unknown }
  | { type: "LOAD_SPEC"; spec: RoomSpec } // from History restore
  | { type: "SAVE_START" }
  | { type: "SAVE_OK" }
  | { type: "SAVE_ERR"; errors: Record<string, string[]> }
  | { type: "CLEAR_ERRORS" };

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "SET_FIELD": {
      const nextSpec = setAt(state.spec, action.path, action.value) as RoomSpec;
      return { ...state, spec: nextSpec, isDirty: true };
    }
    case "LOAD_SPEC":
      // Restoring from history: spec replaced, form dirty so designer must Save.
      return { ...state, spec: action.spec, isDirty: true, errors: {} };
    case "SAVE_START":
      return { ...state, saving: true, errors: {} };
    case "SAVE_OK":
      return { ...state, saving: false, isDirty: false, errors: {} };
    case "SAVE_ERR":
      return { ...state, saving: false, errors: action.errors };
    case "CLEAR_ERRORS":
      return { ...state, errors: {} };
  }
}

/**
 * Immutable set at a dotted path. Creates nested objects/arrays as needed.
 */
function setAt(obj: unknown, path: string, value: unknown): unknown {
  const segments = path.split(".");
  function go(cursor: unknown, i: number): unknown {
    const key = segments[i];
    const isIndex = /^\d+$/.test(key);
    if (i === segments.length - 1) {
      if (isIndex && Array.isArray(cursor)) {
        const next = [...cursor];
        next[Number(key)] = value;
        return next;
      }
      return { ...(cursor as Record<string, unknown>), [key]: value };
    }
    const existing = (cursor as Record<string, unknown>)?.[key];
    const nextChild = go(existing, i + 1);
    if (isIndex && Array.isArray(cursor)) {
      const arr = [...cursor];
      arr[Number(key)] = nextChild;
      return arr;
    }
    return { ...(cursor as Record<string, unknown>), [key]: nextChild };
  }
  return go(obj, 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  roomId: string;
  roomName: string;
  roomType: RoomSpec["room_type"];
  initialSpec: RoomSpec;
  initialVersion: number | null; // null if no spec saved yet
}

export function RoomSpecForm({
  roomId,
  roomName,
  roomType,
  initialSpec,
  initialVersion,
}: Props) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [state, dispatch] = useReducer(reducer, {
    spec: initialSpec,
    isDirty: false,
    errors: {},
    saving: false,
  });

  const fieldContext: FieldContext = {
    roomType,
    roomId,
    // Readers grab the latest spec snapshot at suggest-time so partial_spec
    // reflects what the designer has typed so far.
    getPartialSpec: () => state.spec as unknown as Record<string, unknown>,
  };

  async function save() {
    const parsed = RoomSpecSchema.safeParse(state.spec);
    if (!parsed.success) {
      const flat = parsed.error.flatten((issue) => issue.message);
      // Convert Zod's fieldErrors (path segments) into dotted keys matching
      // what the FieldRenderer reads. Zod's flatten uses the TOP-LEVEL keys
      // only — for nested errors we use error.errors directly.
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        errors[key] = errors[key] ?? [];
        errors[key].push(issue.message);
      }
      dispatch({ type: "SAVE_ERR", errors });
      toast.error(
        `${parsed.error.issues.length} field${parsed.error.issues.length > 1 ? "s" : ""} need attention`,
      );
      return;
    }

    dispatch({ type: "SAVE_START" });
    try {
      const res = await fetch(`/api/rooms/${roomId}/spec`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) {
        const errs: Record<string, string[]> = {};
        const details = body?.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        if (details) Object.assign(errs, details);
        dispatch({ type: "SAVE_ERR", errors: errs });
        toast.error(body?.error ?? "Save failed");
        return;
      }
      dispatch({ type: "SAVE_OK" });
      toast.success(`Spec saved (v${body.version})`);
      router.refresh();
    } catch (e) {
      dispatch({
        type: "SAVE_ERR",
        errors: { _root: [e instanceof Error ? e.message : "network error"] },
      });
      toast.error("Network error — retry?");
    }
  }

  function handleFieldChange(path: string, value: unknown) {
    dispatch({ type: "SET_FIELD", path, value });
  }

  function handleRestore(spec: RoomSpec) {
    dispatch({ type: "LOAD_SPEC", spec });
    toast.info("Version restored — save to create a new version.");
  }

  const errorCount = Object.keys(state.errors).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">{roomName || "Untitled room"}</h1>
          <p className="text-xs text-muted-foreground">
            {roomType.replace(/_/g, " ")} ·{" "}
            {initialVersion != null
              ? `current: v${initialVersion}`
              : "no spec saved yet"}{" "}
            {state.isDirty ? (
              <span className="text-amber-600">· unsaved changes</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon className="mr-1 size-4" /> History
          </Button>
          <Button type="button" onClick={save} disabled={state.saving}>
            {state.saving ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Save className="mr-1 size-4" />
            )}
            Save Spec
          </Button>
        </div>
      </header>

      {errorCount >= 3 ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorCount} fields need attention before saving. Scroll down to see
          each one.
        </div>
      ) : null}

      <VariantForm
        spec={state.spec}
        errors={state.errors}
        onChange={handleFieldChange}
        context={fieldContext}
      />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        roomId={roomId}
        currentVersion={initialVersion}
        onRestore={handleRestore}
      />
    </div>
  );
}
