"use client";

import type { Category } from "@/lib/briefs/categories";
import { MoodboardCategoryTile, type MoodboardTileState } from "./moodboard-category-tile";

export function MoodboardGrid({
  categories,
  roomId,
  roomType,
  state,
  onChangeCategory,
  favoriteStoragePaths,
  onFavoritePathSaved,
}: {
  categories: Category[];
  roomId: string;
  roomType: string;
  state: Record<string, MoodboardTileState>;
  onChangeCategory: (categoryKey: string, next: MoodboardTileState) => void;
  favoriteStoragePaths: ReadonlySet<string>;
  onFavoritePathSaved: (storagePath: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((cat) => {
        const tileState =
          state[cat.key] ?? {
            image_storage_paths: [],
            signed_urls: {},
            notes: "",
          };
        return (
          <MoodboardCategoryTile
            key={cat.key}
            category={cat}
            roomId={roomId}
            roomType={roomType}
            state={tileState}
            onChange={(next) => onChangeCategory(cat.key, next)}
            favoriteStoragePaths={favoriteStoragePaths}
            onFavoritePathSaved={onFavoritePathSaved}
          />
        );
      })}
    </div>
  );
}
