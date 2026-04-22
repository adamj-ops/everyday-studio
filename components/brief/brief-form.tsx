"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MoodboardGrid } from "./moodboard-grid";
import { CreativeQuestions } from "./creative-questions";
import { NonNegotiables } from "./non-negotiables";
import { BriefHistoryDialog } from "./brief-history-dialog";
import { categoriesForRoom } from "@/lib/briefs/categories";
import { questionsForRoom } from "@/lib/briefs/questions";
import { roomTypeLabel } from "@/lib/briefs/room-types";
import type { RoomBriefRow } from "@/lib/briefs/schema";
import type { MoodboardTileState } from "./moodboard-category-tile";

type TileMap = Record<string, MoodboardTileState>;

interface State {
  creative_answers: Record<string, string>;
  non_negotiables: string;
  tiles: TileMap;
  dirty: boolean;
  lastSavedVersion: number | null;
}

type Action =
  | { type: "set_answers"; value: Record<string, string> }
  | { type: "set_non_negotiables"; value: string }
  | { type: "set_tile"; key: string; value: MoodboardTileState }
  | { type: "mark_saved"; version: number }
  | { type: "restore"; value: Omit<State, "dirty" | "lastSavedVersion"> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_answers":
      return { ...state, creative_answers: action.value, dirty: true };
    case "set_non_negotiables":
      return { ...state, non_negotiables: action.value, dirty: true };
    case "set_tile":
      return { ...state, tiles: { ...state.tiles, [action.key]: action.value }, dirty: true };
    case "mark_saved":
      return { ...state, dirty: false, lastSavedVersion: action.version };
    case "restore":
      return {
        ...action.value,
        dirty: true,
        lastSavedVersion: state.lastSavedVersion,
      };
    default:
      return state;
  }
}

function briefToState(
  brief: RoomBriefRow | null,
  signedUrlsByPath: Record<string, string>,
): Omit<State, "dirty" | "lastSavedVersion"> {
  const tiles: TileMap = {};
  if (brief) {
    for (const cm of brief.category_moodboards) {
      const signed: Record<string, string> = {};
      for (const p of cm.image_storage_paths) {
        const url = signedUrlsByPath[p];
        if (url) signed[p] = url;
      }
      tiles[cm.category_key] = {
        image_storage_paths: [...cm.image_storage_paths],
        signed_urls: signed,
        notes: cm.notes ?? "",
        upload_filenames: {},
      };
    }
  }
  return {
    creative_answers: brief?.creative_answers ?? {},
    non_negotiables: brief?.non_negotiables ?? "",
    tiles,
  };
}

export function BriefForm({
  roomId,
  propertyId,
  propertyAddress,
  roomType,
  roomLabel,
  initialBrief,
  initialSignedUrls,
}: {
  roomId: string;
  propertyId: string;
  propertyAddress: string;
  roomType: string;
  roomLabel: string;
  initialBrief: RoomBriefRow | null;
  initialSignedUrls: Record<string, string>;
}) {
  const router = useRouter();
  const categories = useMemo(() => categoriesForRoom(roomType), [roomType]);
  const questions = useMemo(() => questionsForRoom(roomType), [roomType]);

  const [state, dispatch] = useReducer(
    reducer,
    null,
    (): State => ({
      ...briefToState(initialBrief, initialSignedUrls),
      dirty: false,
      lastSavedVersion: initialBrief?.version ?? null,
    }),
  );

  const [isSaving, startSaving] = useTransition();
  const [favoriteStoragePaths, setFavoriteStoragePaths] = useState<Set<string>>(() => new Set());

  const refreshFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) return;
      const body = (await res.json()) as { favorites?: { storage_path: string }[] };
      setFavoriteStoragePaths(
        new Set((body.favorites ?? []).map((f) => f.storage_path).filter(Boolean)),
      );
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  const onFavoritePathSaved = useCallback((storagePath: string) => {
    setFavoriteStoragePaths((prev) => new Set([...prev, storagePath]));
  }, []);

  const hasSaved = state.lastSavedVersion !== null && !state.dirty;

  const persist = async (): Promise<number | null> => {
    const categoryMoodboards = categories
      .map((cat) => {
        const tile = state.tiles[cat.key];
        if (!tile || (tile.image_storage_paths.length === 0 && !tile.notes.trim())) {
          return null;
        }
        return {
          category_key: cat.key,
          category_label: cat.label,
          image_storage_paths: tile.image_storage_paths,
          notes: tile.notes.trim() === "" ? null : tile.notes.trim(),
        };
      })
      .filter(Boolean);

    // Strip empty answers server-side too — no need to persist untouched keys.
    const trimmedAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(state.creative_answers)) {
      if (typeof v === "string" && v.trim() !== "") trimmedAnswers[k] = v.trim();
    }

    const payload = {
      creative_answers: trimmedAnswers,
      non_negotiables: state.non_negotiables.trim() === "" ? null : state.non_negotiables.trim(),
      category_moodboards: categoryMoodboards,
    };

    const res = await fetch(`/api/rooms/${roomId}/brief`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body?.error === "string" ? body.error : "Could not save brief");
    }
    const body = (await res.json()) as { brief: { version: number } };
    return body.brief.version;
  };

  const onSave = () => {
    startSaving(async () => {
      try {
        const version = await persist();
        if (version !== null) {
          dispatch({ type: "mark_saved", version });
          toast.success(`Brief saved (v${version})`);
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save brief");
      }
    });
  };

  const onGenerate = async () => {
    if (state.dirty || state.lastSavedVersion === null) {
      toast.error("Save your brief before generating.");
      return;
    }
    router.push(`/properties/${propertyId}/rooms/${roomId}/studio`);
  };

  const onRestoreVersion = async (v: RoomBriefRow) => {
    // Re-sign the image URLs for the restored version's paths.
    let signed: Record<string, string> = {};
    const allPaths = v.category_moodboards.flatMap((cm) => cm.image_storage_paths);
    if (allPaths.length > 0) {
      try {
        const res = await fetch(`/api/rooms/${roomId}/moodboard/sign-view`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paths: allPaths }),
        });
        if (res.ok) {
          const body = (await res.json()) as { urls?: Record<string, string> };
          signed = body.urls ?? {};
        }
      } catch {
        // non-fatal — tiles will render without previews
      }
    }
    dispatch({ type: "restore", value: briefToState(v, signed) });
    toast.message(`Restored v${v.version} into the form — save to persist.`);
  };

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/dashboard" className="underline-offset-4 hover:underline">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/properties/${propertyId}`}
              className="underline-offset-4 hover:underline"
            >
              {propertyAddress}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">
            {roomTypeLabel(roomType)} — {roomLabel}
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Brief</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-balance font-heading text-2xl font-medium">
            {roomLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            {roomTypeLabel(roomType)} brief
            {state.lastSavedVersion !== null && !state.dirty && (
              <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                · saved v{state.lastSavedVersion}
              </span>
            )}
            {state.dirty && (
              <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                · unsaved changes
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BriefHistoryDialog roomId={roomId} onRestore={(v) => void onRestoreVersion(v)} />
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save brief"}
          </Button>
          <Link
            href={
              hasSaved
                ? `/properties/${propertyId}/rooms/${roomId}/studio`
                : "#"
            }
            aria-disabled={!hasSaved || undefined}
            onClick={(e) => {
              if (!hasSaved) {
                e.preventDefault();
                void onGenerate();
              }
            }}
            className={cn(
              buttonVariants({ variant: "outline" }),
              !hasSaved && "cursor-not-allowed opacity-50",
            )}
          >
            Generate mockup
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-medium">Moodboard</h2>
          <p className="text-pretty text-sm text-muted-foreground">
            Upload inspiration for each category. Images show the direction; notes
            pin specific choices.
          </p>
        </div>
        <MoodboardGrid
          categories={categories}
          roomId={roomId}
          roomType={roomType}
          state={state.tiles}
          onChangeCategory={(key, value) => dispatch({ type: "set_tile", key, value })}
          favoriteStoragePaths={favoriteStoragePaths}
          onFavoritePathSaved={onFavoritePathSaved}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-medium">Creative direction</h2>
          <p className="text-pretty text-sm text-muted-foreground">
            All optional. Answer the ones that help you think; skip the rest.
          </p>
        </div>
        <CreativeQuestions
          questions={questions}
          answers={state.creative_answers}
          onChange={(next) => dispatch({ type: "set_answers", value: next })}
        />
      </section>

      <section className="space-y-4">
        <NonNegotiables
          value={state.non_negotiables}
          onChange={(next) => dispatch({ type: "set_non_negotiables", value: next })}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving…" : state.dirty ? "Save brief" : "Save again"}
        </Button>
        <Link
          href={`/properties/${propertyId}`}
          className={buttonVariants({ variant: "ghost" })}
        >
          Back to property
        </Link>
      </div>
    </div>
  );
}
