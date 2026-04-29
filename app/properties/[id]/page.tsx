import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buyerPersonaLabel, formatUsd } from "@/lib/properties/property";
import { spaceTypeLabel } from "@/lib/briefs/space-types";
import { signPhotoUrls } from "@/lib/supabase/signed-urls";
import { budgetTierLabel, themePresetLabel } from "@/lib/briefs/themes";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoUploadSheet } from "@/components/photo-upload-sheet";
import { EditPropertyDialog } from "@/components/edit-property-dialog";
import { ThemeNudgeBanner } from "@/components/theme/theme-nudge-banner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export const metadata = { title: "Property — Everyday Studio" };

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [propertyResult, photosResult, spacesResult, themeResult, briefResult] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("property_photos")
        .select("id, storage_path, room_label, uploaded_at")
        .eq("property_id", id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("spaces")
        .select("id, space_type, label")
        .eq("property_id", id)
        .order("space_type"),
      supabase
        .from("project_themes")
        .select("id, budget_tier, theme_preset")
        .eq("property_id", id)
        .maybeSingle(),
      supabase
        .from("space_briefs")
        .select("space_id, version")
        .order("version", { ascending: false }),
    ]);

  if (propertyResult.error || !propertyResult.data) {
    notFound();
  }

  const property = propertyResult.data;
  const photos = photosResult.data ?? [];
  const spaces = spacesResult.data ?? [];
  const theme = themeResult.data;

  // Map space_id -> latest brief version (first row per room thanks to the DESC sort).
  const latestBriefByRoom = new Map<string, number>();
  for (const row of (briefResult.data ?? []) as Array<{ space_id: string; version: number }>) {
    if (!latestBriefByRoom.has(row.space_id)) {
      latestBriefByRoom.set(row.space_id, row.version);
    }
  }

  let photoUrlsSignFailed = false;
  const signedUrls = photos.length
    ? await signPhotoUrls(
        supabase,
        photos.map((p) => p.storage_path),
      ).catch((err) => {
        console.error("[signPhotoUrls]", err);
        photoUrlsSignFailed = true;
        return {} as Record<string, string>;
      })
    : {};

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      {!theme && <ThemeNudgeBanner propertyId={property.id} />}

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-balance text-2xl font-semibold">{property.address}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {property.city}, {property.state} {property.zip}
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">ARV</dt>
              <dd>{formatUsd(property.arv_estimate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Buyer</dt>
              <dd>{buyerPersonaLabel(property.buyer_persona)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Photos</dt>
              <dd>{photos.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Spaces</dt>
              <dd>{spaces.length}</dd>
            </div>
            {theme && (
              <div>
                <dt className="text-xs text-muted-foreground">Theme</dt>
                <dd>
                  {budgetTierLabel(theme.budget_tier)}
                  {theme.theme_preset ? ` · ${themePresetLabel(theme.theme_preset)}` : ""}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/properties/${property.id}/handoff`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Handoff
          </Link>
          <Link
            href={`/properties/${property.id}/theme`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {theme ? "Edit theme" : "Set theme"}
          </Link>
          <EditPropertyDialog
            property={{
              id: property.id,
              address: property.address,
              city: property.city,
              state: property.state,
              zip: property.zip,
              arv_estimate: property.arv_estimate,
              buyer_persona: property.buyer_persona,
            }}
          />
          <PhotoUploadSheet propertyId={property.id} />
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-medium">Photos</h2>
        {photoUrlsSignFailed ? (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
            Some photos couldn&apos;t be loaded — refresh the page to retry.
          </p>
        ) : null}
        <PhotoGrid photos={photos} spaces={spaces} signedUrls={signedUrls} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Spaces</h2>
        {spaces.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            No spaces yet — add photos to create spaces.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {spaces.map((room) => {
              const briefVersion = latestBriefByRoom.get(room.id) ?? null;
              return (
                <li key={room.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <Link
                    href={`/properties/${id}/spaces/${room.id}/brief`}
                    className="flex flex-1 items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">{room.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {spaceTypeLabel(room.space_type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {briefVersion != null ? (
                        <Badge variant="secondary">Brief v{briefVersion}</Badge>
                      ) : (
                        <Badge variant="outline">Brief: not started</Badge>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
