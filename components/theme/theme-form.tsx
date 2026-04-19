"use client";

import { useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { BudgetTierPicker } from "./budget-tier-picker";
import { ThemePresetPicker } from "./theme-preset-picker";
import type { BudgetTierKey } from "@/lib/briefs/themes";
import type { ProjectThemeRow } from "@/lib/briefs/schema";

type State = {
  budget_tier: BudgetTierKey | null;
  budget_custom_notes: string;
  theme_preset: string | null;
  theme_custom_description: string;
};

type Action =
  | { type: "set_tier"; value: BudgetTierKey }
  | { type: "set_tier_notes"; value: string }
  | { type: "set_preset"; value: string | null }
  | { type: "set_preset_desc"; value: string }
  | { type: "hydrate"; value: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_tier":
      return { ...state, budget_tier: action.value };
    case "set_tier_notes":
      return { ...state, budget_custom_notes: action.value };
    case "set_preset":
      return { ...state, theme_preset: action.value };
    case "set_preset_desc":
      return { ...state, theme_custom_description: action.value };
    case "hydrate":
      return action.value;
    default:
      return state;
  }
}

function toInitialState(theme: ProjectThemeRow | null): State {
  return {
    budget_tier: (theme?.budget_tier as BudgetTierKey | undefined) ?? null,
    budget_custom_notes: theme?.budget_custom_notes ?? "",
    theme_preset: theme?.theme_preset ?? null,
    theme_custom_description: theme?.theme_custom_description ?? "",
  };
}

export function ThemeForm({
  propertyId,
  initialTheme,
  propertyAddress,
}: {
  propertyId: string;
  initialTheme: ProjectThemeRow | null;
  propertyAddress: string;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialTheme, toInitialState);
  const [isSaving, startSaving] = useTransition();

  const validate = (): string | null => {
    if (!state.budget_tier) return "Pick a budget tier before saving.";
    if (state.budget_tier === "custom" && !state.budget_custom_notes.trim()) {
      return "Add custom budget notes, or pick a preset tier.";
    }
    if (state.theme_preset === "custom" && !state.theme_custom_description.trim()) {
      return "Describe your custom aesthetic, or pick a preset.";
    }
    return null;
  };

  const save = () => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    startSaving(async () => {
      const payload = {
        budget_tier: state.budget_tier,
        budget_custom_notes:
          state.budget_tier === "custom" ? state.budget_custom_notes.trim() : null,
        theme_preset: state.theme_preset,
        theme_custom_description:
          state.theme_preset === "custom"
            ? state.theme_custom_description.trim()
            : null,
      };

      try {
        const res = await fetch(`/api/properties/${propertyId}/theme`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            typeof body?.error === "string" ? body.error : "Could not save theme.";
          toast.error(msg);
          return;
        }
        toast.success("Theme saved");
        router.push(`/properties/${propertyId}`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not save theme.";
        toast.error(msg);
      }
    });
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
          <li className="text-foreground">Theme</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="text-balance font-heading text-2xl font-medium">
          Project theme
        </h1>
        <p className="max-w-prose text-pretty text-sm text-muted-foreground">
          Budget tier and aesthetic direction flow into every room render for this
          property. You can change them later and re-render.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-medium">Budget tier</h2>
        <BudgetTierPicker
          value={state.budget_tier}
          customNotes={state.budget_custom_notes}
          onChange={(v) => dispatch({ type: "set_tier", value: v })}
          onCustomNotesChange={(v) => dispatch({ type: "set_tier_notes", value: v })}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-medium">Aesthetic</h2>
        <ThemePresetPicker
          value={state.theme_preset}
          customDescription={state.theme_custom_description}
          onChange={(v) => dispatch({ type: "set_preset", value: v })}
          onCustomDescriptionChange={(v) => dispatch({ type: "set_preset_desc", value: v })}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save theme"}
        </Button>
        <Link
          href={`/properties/${propertyId}`}
          className={buttonVariants({ variant: "ghost" })}
          aria-disabled={isSaving || undefined}
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
