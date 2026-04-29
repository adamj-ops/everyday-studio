import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SpaceBriefSchema,
  type ProjectThemeRow,
  type SpaceBrief,
} from "@/lib/briefs/schema";
import {
  THEME_PRESETS,
  budgetTierLabel,
  themePresetLabel,
} from "@/lib/briefs/themes";
import { spaceTypeLabel } from "@/lib/briefs/space-types";
import { signStorageUrls } from "@/lib/supabase/signed-urls";

const RENDER_TTL_SECONDS = 24 * 60 * 60;
const PHOTO_TTL_SECONDS = 60 * 60;
const REFERENCE_TTL_SECONDS = 60 * 60;

export type HandoffProperty = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  arv_estimate: number | null;
  buyer_persona: string | null;
};

export type HandoffRoom = {
  id: string;
  property_id: string;
  space_type: string;
  label: string;
};

export type HandoffPropertyPhoto = {
  id: string;
  storage_path: string;
  room_label: string | null;
  uploaded_at: string;
};

export type HandoffRender = {
  id: string;
  space_id: string;
  status: string;
  storage_path: string | null;
  created_at: string;
};

export type MoodboardReference = {
  categoryKey: string;
  categoryLabel: string;
  imageUrls: string[];
};

export type HandoffRoomBlock = {
  room: HandoffRoom;
  brief: SpaceBrief;
  briefVersion: number;
  latestRender: (HandoffRender & { signedUrl: string | null }) | null;
  beforePhoto: (HandoffPropertyPhoto & { signedUrl: string | null }) | null;
  moodboardReferences: MoodboardReference[];
};

export type HandoffData = {
  property: HandoffProperty;
  theme: ProjectThemeRow | null;
  spaces: HandoffRoomBlock[];
};

function pickBeforePhoto(
  photos: HandoffPropertyPhoto[],
  room: HandoffRoom,
): HandoffPropertyPhoto | null {
  if (photos.length === 0) return null;
  const roomLabelLc = room.label.toLowerCase();
  return (
    photos.find((p) => (p.room_label ?? "").toLowerCase() === roomLabelLc) ??
    photos.find((p) =>
      (p.room_label ?? "").toLowerCase().includes(room.space_type.toLowerCase()),
    ) ??
    photos[0] ??
    null
  );
}

function themePresetDescription(preset: string | null | undefined): string | null {
  if (!preset || preset === "custom") return null;
  const entry = THEME_PRESETS.find((p) => p.key === preset);
  return entry?.description ?? null;
}

/**
 * Narrative for the handoff "design direction" section.
 */
export function buildDesignDirectionSummary(data: HandoffData): string {
  const { theme, spaces } = data;
  const tierLabel = theme ? budgetTierLabel(theme.budget_tier) : "unspecified tier";
  const presetLabel =
    theme?.theme_preset != null ? themePresetLabel(theme.theme_preset) : "custom direction";
  const presetDesc =
    theme?.theme_preset === "custom"
      ? (theme.theme_custom_description ?? "").trim()
      : themePresetDescription(theme?.theme_preset ?? null) ?? "";

  const nonNegotLines: string[] = [];
  for (const block of spaces) {
    const t = (block.brief.non_negotiables ?? "").trim();
    if (t) nonNegotLines.push(t);
  }
  const nonNegotSnippet =
    nonNegotLines.length > 0
      ? ` Must-haves and constraints called out in room briefs include: ${nonNegotLines
          .slice(0, 3)
          .map((s) => s.replace(/\s+/g, " ").slice(0, 160))
          .join(" ")}${nonNegotLines.length > 3 ? "…" : ""}`
      : "";

  if (presetDesc) {
    return `This project follows a ${presetLabel} direction at the ${tierLabel} investment level. ${presetDesc}${nonNegotSnippet}`.trim();
  }

  const roomList = spaces.map((r) => r.room.label || spaceTypeLabel(r.room.space_type)).join(", ");
  return `Property styled in ${presetLabel} aesthetic at ${tierLabel} tier.${roomList ? ` Spaces in scope: ${roomList}.` : ""}`.trim();
}

export async function loadHandoffData(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<HandoffData | null> {
  const [propertyResult, themeResult, spacesResult] = await Promise.all([
    supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
    supabase.from("project_themes").select("*").eq("property_id", propertyId).maybeSingle(),
    supabase
      .from("spaces")
      .select("id, property_id, space_type, label")
      .eq("property_id", propertyId)
      .order("space_type")
      .order("label"),
  ]);

  if (propertyResult.error || !propertyResult.data) return null;

  const row = propertyResult.data as Record<string, unknown>;
  const property: HandoffProperty = {
    id: String(row.id),
    address: String(row.address),
    city: String(row.city),
    state: String(row.state),
    zip: String(row.zip),
    arv_estimate: row.arv_estimate != null ? Number(row.arv_estimate) : null,
    buyer_persona: row.buyer_persona != null ? String(row.buyer_persona) : null,
  };

  const theme = (themeResult.data as ProjectThemeRow | null) ?? null;
  const spaces = (spacesResult.data ?? []) as HandoffRoom[];
  const spaceIds = spaces.map((r) => r.id);

  if (spaceIds.length === 0) {
    return { property, theme, spaces: [] };
  }

  const [briefsResult, rendersResult, photosResult] = await Promise.all([
    supabase
      .from("space_briefs")
      .select(
        "id, space_id, version, surface_type, creative_answers, non_negotiables, category_moodboards",
      )
      .in("space_id", spaceIds),
    supabase
      .from("renders")
      .select("id, space_id, status, storage_path, created_at")
      .in("space_id", spaceIds)
      .eq("status", "complete")
      .order("created_at", { ascending: false }),
    supabase
      .from("property_photos")
      .select("id, storage_path, room_label, uploaded_at")
      .eq("property_id", propertyId)
      .order("uploaded_at", { ascending: false }),
  ]);

  const briefRows = (briefsResult.data ?? []) as Array<{
    id: string;
    space_id: string;
    version: number;
    creative_answers: unknown;
    non_negotiables: unknown;
    category_moodboards: unknown;
  }>;

  const latestBriefByRoom = new Map<string, (typeof briefRows)[0]>();
  for (const br of briefRows) {
    const cur = latestBriefByRoom.get(br.space_id);
    if (!cur || br.version > cur.version) latestBriefByRoom.set(br.space_id, br);
  }

  const renderRows = (rendersResult.data ?? []) as HandoffRender[];
  const latestRenderByRoom = new Map<string, HandoffRender>();
  for (const rr of renderRows) {
    if (!latestRenderByRoom.has(rr.space_id)) latestRenderByRoom.set(rr.space_id, rr);
  }

  const photos = (photosResult.data ?? []) as HandoffPropertyPhoto[];

  const photoPaths: string[] = [];
  const renderPaths: string[] = [];
  const referencePaths: string[] = [];

  const blocks: HandoffRoomBlock[] = [];

  for (const room of spaces) {
    const briefRow = latestBriefByRoom.get(room.id);
    if (!briefRow) continue;

    const parsed = SpaceBriefSchema.safeParse({
      creative_answers: briefRow.creative_answers ?? {},
      non_negotiables: briefRow.non_negotiables ?? null,
      category_moodboards: Array.isArray(briefRow.category_moodboards)
        ? briefRow.category_moodboards
        : [],
    });
    if (!parsed.success) continue;

    const brief = parsed.data;
    const before = pickBeforePhoto(photos, room);
    if (before) photoPaths.push(before.storage_path);

    const latestRender = latestRenderByRoom.get(room.id) ?? null;
    if (latestRender?.storage_path) renderPaths.push(latestRender.storage_path);

    for (const cm of brief.category_moodboards) {
      for (const p of cm.image_storage_paths) referencePaths.push(p);
    }

    blocks.push({
      room,
      brief,
      briefVersion: briefRow.version,
      latestRender: latestRender
        ? { ...latestRender, signedUrl: null }
        : null,
      beforePhoto: before
        ? { ...before, signedUrl: null }
        : null,
      moodboardReferences: brief.category_moodboards.map((cm) => ({
        categoryKey: cm.category_key,
        categoryLabel: cm.category_label,
        imageUrls: [],
      })),
    });
  }

  const uniquePhoto = [...new Set(photoPaths)];
  const uniqueRender = [...new Set(renderPaths)];
  const uniqueRef = [...new Set(referencePaths)];

  const [photoUrls, renderUrls, refUrls] = await Promise.all([
    uniquePhoto.length
      ? signStorageUrls(supabase, "property-photos", uniquePhoto, PHOTO_TTL_SECONDS)
      : Promise.resolve({} as Record<string, string>),
    uniqueRender.length
      ? signStorageUrls(supabase, "renders", uniqueRender, RENDER_TTL_SECONDS)
      : Promise.resolve({} as Record<string, string>),
    uniqueRef.length
      ? signStorageUrls(
          supabase,
          "property-references",
          uniqueRef,
          REFERENCE_TTL_SECONDS,
        )
      : Promise.resolve({} as Record<string, string>),
  ]);

  for (const block of blocks) {
    if (block.beforePhoto) {
      block.beforePhoto.signedUrl =
        photoUrls[block.beforePhoto.storage_path] ?? null;
    }
    if (block.latestRender?.storage_path) {
      block.latestRender.signedUrl =
        renderUrls[block.latestRender.storage_path] ?? null;
    }

    const pathToUrl = (path: string) => refUrls[path] ?? null;
    block.moodboardReferences = block.brief.category_moodboards.map((cm) => ({
      categoryKey: cm.category_key,
      categoryLabel: cm.category_label,
      imageUrls: cm.image_storage_paths
        .map((p) => pathToUrl(p))
        .filter((u): u is string => u != null),
    }));
  }

  return { property, theme, spaces: blocks };
}
