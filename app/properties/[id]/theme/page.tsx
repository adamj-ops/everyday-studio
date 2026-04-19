import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeForm } from "@/components/theme/theme-form";
import type { ProjectThemeRow } from "@/lib/briefs/schema";

export const metadata = { title: "Project theme — Everyday Studio" };

export default async function PropertyThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [propertyResult, themeResult] = await Promise.all([
    supabase.from("properties").select("id, address").eq("id", id).maybeSingle(),
    supabase
      .from("project_themes")
      .select(
        "id, property_id, budget_tier, budget_custom_notes, theme_preset, theme_custom_description, created_at, updated_at",
      )
      .eq("property_id", id)
      .maybeSingle(),
  ]);

  if (propertyResult.error || !propertyResult.data) {
    notFound();
  }

  return (
    <ThemeForm
      propertyId={id}
      propertyAddress={propertyResult.data.address}
      initialTheme={(themeResult.data as ProjectThemeRow | null) ?? null}
    />
  );
}
