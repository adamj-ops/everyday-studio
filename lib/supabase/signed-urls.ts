import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_TTL_SECONDS = 60 * 60;

export async function signPhotoUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("property-photos")
    .createSignedUrls(storagePaths, ttlSeconds);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}
