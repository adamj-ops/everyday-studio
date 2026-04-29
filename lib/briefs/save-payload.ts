import { SurfaceTypeEnum, type CategoryMoodboard, type SurfaceType } from "./schema";

interface BriefSaveCategory {
  key: string;
  label: string;
}

interface BriefSaveTile {
  image_storage_paths: string[];
  notes: string;
}

export interface SpaceBriefSavePayload {
  surface_type: SurfaceType;
  creative_answers: Record<string, string>;
  non_negotiables: string | null;
  category_moodboards: CategoryMoodboard[];
}

export function buildSpaceBriefSavePayload(args: {
  spaceType: string;
  initialSurfaceType: SurfaceType | null | undefined;
  creativeAnswers: Record<string, string>;
  nonNegotiables: string;
  categories: BriefSaveCategory[];
  tiles: Record<string, BriefSaveTile | undefined>;
}): SpaceBriefSavePayload {
  const categoryMoodboards = args.categories
    .map((cat) => {
      const tile = args.tiles[cat.key];
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
    .filter((row): row is CategoryMoodboard => row !== null);

  const trimmedAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(args.creativeAnswers)) {
    if (typeof value === "string" && value.trim() !== "") trimmedAnswers[key] = value.trim();
  }

  return {
    surface_type: resolveBriefSurfaceType(args.spaceType, args.initialSurfaceType),
    creative_answers: trimmedAnswers,
    non_negotiables: args.nonNegotiables.trim() === "" ? null : args.nonNegotiables.trim(),
    category_moodboards: categoryMoodboards,
  };
}

function resolveBriefSurfaceType(
  spaceType: string,
  initialSurfaceType: SurfaceType | null | undefined,
): SurfaceType {
  const parsedSpaceType = SurfaceTypeEnum.safeParse(spaceType);
  if (parsedSpaceType.success && parsedSpaceType.data !== "interior_room") {
    return parsedSpaceType.data;
  }

  return initialSurfaceType ?? "interior_room";
}
