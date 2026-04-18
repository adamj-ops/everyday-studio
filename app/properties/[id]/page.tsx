import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buyerPersonaLabel, formatUsd } from "@/lib/specs/property";
import { roomTypeLabel } from "@/lib/specs/rooms";
import { signPhotoUrls } from "@/lib/supabase/signed-urls";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoUploadSheet } from "@/components/photo-upload-sheet";
import { EditPropertyDialog } from "@/components/edit-property-dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

export const metadata = { title: "Property — Everyday Studio" };

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [propertyResult, photosResult, roomsResult] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("property_photos")
      .select("id, storage_path, room_label, uploaded_at")
      .eq("property_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("rooms")
      .select("id, room_type, label, room_specs(version)")
      .eq("property_id", id)
      .order("room_type")
      .order("version", { ascending: false, referencedTable: "room_specs" })
      .limit(1, { referencedTable: "room_specs" }),
  ]);

  if (propertyResult.error || !propertyResult.data) {
    notFound();
  }

  const property = propertyResult.data;
  const photos = photosResult.data ?? [];
  const rooms = roomsResult.data ?? [];

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

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{property.address}</h1>
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
          </dl>
        </div>
        <div className="flex items-center gap-2">
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
              const specVersion = Array.isArray((room as { room_specs?: unknown }).room_specs)
                ? (((room as { room_specs: { version?: number }[] }).room_specs[0])?.version ?? null)
                : null;
              return (
                <li key={room.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <Link
                    href={`/properties/${id}/rooms/${room.id}/spec`}
                    className="flex flex-1 items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">{room.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {roomTypeLabel(room.room_type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {specVersion != null ? (
                        <Badge variant="secondary">Spec v{specVersion}</Badge>
                      ) : (
                        <Badge variant="outline">Spec: not started</Badge>
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
