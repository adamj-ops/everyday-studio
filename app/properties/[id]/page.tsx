import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buyerPersonaLabel, formatUsd } from "@/lib/properties/property";
import { roomTypeLabel } from "@/lib/briefs/room-types";
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

  const [propertyResult, photosResult, roomsResult, themeResult, briefResult] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("property_photos")
        .select("id, storage_path, room_label, uploaded_at")
        .eq("property_id", id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("rooms")
        .select("id, room_type, label")
        .eq("property_id", id)
        .order("room_type"),
      supabase
        .from("project_themes")
        .select("id, budget_tier, theme_preset")
        .eq("property_id", id)
        .maybeSingle(),
      supabase
        .from("room_briefs")
        .select("room_id, version")
        .order("version", { ascending: false }),
    ]);

  if (propertyResult.error || !propertyResult.data) {
    notFound();
  }

  const property = propertyResult.data;
  const photos = photosResult.data ?? [];
  const rooms = roomsResult.data ?? [];
  const theme = themeResult.data;

  // Map room_id -> latest brief version (first row per room thanks to the DESC sort).
  const latestBriefByRoom = new Map<string, number>();
  for (const row of (briefResult.data ?? []) as Array<{ room_id: string; version: number }>) {
    if (!latestBriefByRoom.has(row.room_id)) {
      latestBriefByRoom.set(row.room_id, row.version);
    }
  }

  const signedUrls = photos.length
    ? await signPhotoUrls(
        supabase,
        photos.map((p) => p.storage_path),
      ).catch(() => ({}) as Record<string, string>)
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
              <dt className="text-xs text-muted-foreground">Rooms</dt>
              <dd>{rooms.length}</dd>
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
        <div className="flex items-center gap-2">
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
        <PhotoGrid photos={photos} rooms={rooms} signedUrls={signedUrls} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Rooms</h2>
        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            No rooms yet — add photos to create rooms.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {rooms.map((room) => {
              const briefVersion = latestBriefByRoom.get(room.id) ?? null;
              return (
                <li key={room.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <Link
                    href={`/properties/${id}/rooms/${room.id}/brief`}
                    className="flex flex-1 items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">{room.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {roomTypeLabel(room.room_type)}
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
