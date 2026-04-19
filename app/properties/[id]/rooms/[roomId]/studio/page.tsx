import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomSpecSchema, type RoomSpec } from "@/lib/specs/schema";
import { signStorageUrls } from "@/lib/supabase/signed-urls";
import { StudioWorkspace } from "@/components/mockup-studio/studio-workspace";
import { type ReferenceItem } from "@/components/mockup-studio/references-panel";

export const metadata = { title: "Mockup Studio — Everyday Studio" };

const RENDER_TTL = 24 * 60 * 60;
const REFERENCE_TTL = 60 * 60;

export default async function MockupStudioPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id: propertyId, roomId } = await params;
  const supabase = await createClient();

  const [propertyResult, roomResult, specResult, renderResult, referencesResult] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
      supabase
        .from("rooms")
        .select("id, room_type, label, property_id")
        .eq("id", roomId)
        .maybeSingle(),
      supabase
        .from("room_specs")
        .select("id, version, spec_json")
        .eq("room_id", roomId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("renders")
        .select(
          "id, status, storage_path, opus_verdict, opus_critiques_json, created_at",
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("reference_materials")
        .select("id, label, storage_path, scope, room_id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false }),
    ]);

  if (propertyResult.error || !propertyResult.data) notFound();
  if (roomResult.error || !roomResult.data) notFound();
  if (roomResult.data.property_id !== propertyId) notFound();

  const property = propertyResult.data;
  const room = roomResult.data as {
    id: string;
    room_type: RoomSpec["room_type"];
    label: string;
    property_id: string;
  };

  const specRow = specResult.data;
  let spec: RoomSpec | null = null;
  let specVersion: number | null = null;
  if (specRow) {
    const parsed = RoomSpecSchema.safeParse(specRow.spec_json);
    if (parsed.success) {
      spec = parsed.data;
      specVersion = specRow.version;
    }
  }

  // Base photo selection — match by room_label first, fall back to room_type
  // substring. This is the photo the Generate call sends to Gemini as the
  // before-state anchor.
  const { data: photosData } = await supabase
    .from("property_photos")
    .select("id, storage_path, room_label")
    .eq("property_id", propertyId)
    .order("uploaded_at", { ascending: false });
  const photos = photosData ?? [];
  const roomLabelLc = room.label.toLowerCase();
  const basePhoto =
    photos.find((p) => (p.room_label ?? "").toLowerCase() === roomLabelLc) ??
    photos.find((p) => (p.room_label ?? "").toLowerCase().includes(room.room_type)) ??
    null;

  const renderRow = renderResult.data;
  let initialRender: Parameters<typeof StudioWorkspace>[0]["initialRender"] = null;
  if (renderRow) {
    let signedUrl: string | null = null;
    if (renderRow.storage_path) {
      const urls = await signStorageUrls(
        supabase,
        "renders",
        [renderRow.storage_path],
        RENDER_TTL,
      ).catch(() => ({}) as Record<string, string>);
      signedUrl = urls[renderRow.storage_path] ?? null;
    }
    initialRender = {
      id: renderRow.id,
      status: renderRow.status,
      signed_url: signedUrl,
      opus_verdict: renderRow.opus_verdict,
      opus_critiques_json: renderRow.opus_critiques_json,
      created_at: renderRow.created_at,
    };
  }

  const references = referencesResult.data ?? [];
  const scopedReferences = references.filter(
    (r) => r.scope === "property" || r.room_id === roomId,
  );
  const refSignedUrls = scopedReferences.length
    ? await signStorageUrls(
        supabase,
        "property-references",
        scopedReferences.map((r) => r.storage_path),
        REFERENCE_TTL,
      ).catch(() => ({}) as Record<string, string>)
    : {};
  const referenceItems: ReferenceItem[] = scopedReferences.map((r) => ({
    id: r.id,
    label: r.label,
    storage_path: r.storage_path,
    signed_url: refSignedUrls[r.storage_path] ?? null,
    scope: r.scope as "property" | "room",
  }));

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        {" / "}
        <Link href={`/properties/${propertyId}`} className="hover:underline">
          {property.address}
        </Link>
        {" / "}
        <Link
          href={`/properties/${propertyId}/rooms/${roomId}/spec`}
          className="hover:underline"
        >
          {room.label}
        </Link>
        {" / "}
        <span>Studio</span>
      </nav>

      {spec === null ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">No spec for this room yet.</p>
          <p className="mb-4 text-pretty">
            Build and save the Room Spec before opening the Mockup Studio.
          </p>
          <Link
            href={`/properties/${propertyId}/rooms/${roomId}/spec`}
            className="text-sm underline-offset-4 hover:underline"
          >
            Open Spec Builder →
          </Link>
        </div>
      ) : (
        <StudioWorkspace
          spec={spec}
          specVersion={specVersion ?? 1}
          propertyId={propertyId}
          roomId={roomId}
          basePhotoId={basePhoto?.id ?? null}
          references={referenceItems}
          initialRender={initialRender}
        />
      )}
    </div>
  );
}
