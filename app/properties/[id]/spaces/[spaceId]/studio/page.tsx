import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyAddress, slugifySpaceType } from "@/lib/properties/slug";
import { signStorageUrls } from "@/lib/supabase/signed-urls";
import { StudioWorkspace } from "@/components/mockup-studio/studio-workspace";
import type { MoodboardImageItem } from "@/components/mockup-studio/moodboard-panel";
import type { SpaceBriefRow, ProjectThemeRow } from "@/lib/briefs/schema";

export const metadata = { title: "Mockup Studio — Everyday Studio" };

const RENDER_TTL = 24 * 60 * 60;
const REFERENCE_TTL = 60 * 60;

export default async function MockupStudioPage({
  params,
}: {
  params: Promise<{ id: string; spaceId: string }>;
}) {
  const { id: propertyId, spaceId } = await params;
  const supabase = await createClient();

  const [propertyResult, roomResult, briefResult, themeResult, renderResult] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
      supabase
        .from("spaces")
        .select("id, space_type, label, property_id")
        .eq("id", spaceId)
        .maybeSingle(),
      supabase
        .from("space_briefs")
        .select(
          "id, space_id, version, surface_type, creative_answers, non_negotiables, category_moodboards, created_at, updated_at",
        )
        .eq("space_id", spaceId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("project_themes")
        .select(
          "id, property_id, budget_tier, budget_custom_notes, theme_preset, theme_custom_description, created_at, updated_at",
        )
        .eq("property_id", propertyId)
        .maybeSingle(),
      supabase
        .from("renders")
        .select(
          "id, status, storage_path, opus_verdict, opus_critiques_json, created_at",
        )
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (propertyResult.error || !propertyResult.data) notFound();
  if (roomResult.error || !roomResult.data) notFound();
  if (roomResult.data.property_id !== propertyId) notFound();

  const property = propertyResult.data;
  const room = roomResult.data as {
    id: string;
    space_type: string;
    label: string;
    property_id: string;
  };

  const brief = (briefResult.data as SpaceBriefRow | null) ?? null;
  const projectTheme = (themeResult.data as ProjectThemeRow | null) ?? null;

  // Base photo selection — match by room_label first, fall back to space_type
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
    photos.find((p) => (p.room_label ?? "").toLowerCase().includes(room.space_type)) ??
    null;

  const renderRow = renderResult.data;
  let initialRender: Parameters<typeof StudioWorkspace>[0]["initialRender"] = null;
  if (renderRow) {
    const { count: versionOrdinal } = await supabase
      .from("renders")
      .select("*", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .lte("created_at", renderRow.created_at);
    const v = versionOrdinal ?? 1;
    let signedUrl: string | null = null;
    if (renderRow.storage_path) {
      try {
        const urls = await signStorageUrls(
          supabase,
          "renders",
          [renderRow.storage_path],
          RENDER_TTL,
        );
        signedUrl = urls[renderRow.storage_path] ?? null;
        if (!signedUrl) {
          console.warn(
            "[studio_sign_render] user-scoped sign returned no url",
            { path: renderRow.storage_path, renderId: renderRow.id },
          );
        }
      } catch (err) {
        console.error(
          "[studio_sign_render] user-scoped sign threw",
          renderRow.storage_path,
          err instanceof Error ? err.message : err,
        );
      }
      if (!signedUrl) {
        try {
          const admin = createAdminClient();
          const urls = await signStorageUrls(
            admin,
            "renders",
            [renderRow.storage_path],
            RENDER_TTL,
          );
          signedUrl = urls[renderRow.storage_path] ?? null;
          if (!signedUrl) {
            console.error(
              "[studio_sign_render_admin] admin sign returned no url",
              { path: renderRow.storage_path, renderId: renderRow.id },
            );
          }
        } catch (err) {
          console.error(
            "[studio_sign_render_admin] threw",
            renderRow.storage_path,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    initialRender = {
      id: renderRow.id,
      status: renderRow.status,
      signed_url: signedUrl,
      opus_verdict: renderRow.opus_verdict,
      opus_critiques_json: renderRow.opus_critiques_json,
      created_at: renderRow.created_at,
      ordinal: v,
    };
  }

  // Sign moodboard images so the studio shows the same references Gemini
  // will receive.
  const moodboardImages: MoodboardImageItem[] = [];
  if (brief) {
    const flat = brief.category_moodboards.flatMap((cm) =>
      cm.image_storage_paths.map((path) => ({
        path,
        category_label: cm.category_label,
      })),
    );
    const paths = flat.map((f) => f.path);
    const signed = paths.length
      ? await signStorageUrls(
          supabase,
          "property-references",
          paths,
          REFERENCE_TTL,
        ).catch((err) => {
          console.error(
            "[studio_sign_moodboard]",
            { count: paths.length, err: err instanceof Error ? err.message : err },
          );
          return {} as Record<string, string>;
        })
      : {};
    for (const f of flat) {
      moodboardImages.push({
        storage_path: f.path,
        signed_url: signed[f.path] ?? null,
        category_label: f.category_label,
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        {" / "}
        <Link href={`/properties/${propertyId}`} className="hover:underline">
          {property.address}
        </Link>
        {" / "}
        <Link
          href={`/properties/${propertyId}/spaces/${spaceId}/brief`}
          className="hover:underline"
        >
          {room.label}
        </Link>
        {" / "}
        <span>Studio</span>
      </nav>

      <StudioWorkspace
        brief={brief}
        projectTheme={projectTheme}
        roomType={room.space_type}
        roomLabel={room.label}
        propertyId={propertyId}
        spaceId={spaceId}
        basePhotoId={basePhoto?.id ?? null}
        moodboardImages={moodboardImages}
        initialRender={initialRender}
        downloadFileParts={{
          addressSlug: slugifyAddress(property.address),
          roomTypeSlug: slugifySpaceType(room.space_type),
        }}
      />
    </div>
  );
}
