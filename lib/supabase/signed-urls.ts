import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_TTL_SECONDS = 60 * 60;

/**
 * Batch-sign N storage paths in one round trip. The caller supplies the
 * bucket name so this works for property-photos, property-references, and
 * renders alike. TTL defaults to 1 hour; pass a longer TTL for artifacts
 * the designer walks away from and returns to (24h for renders).
 */
export async function signStorageUrls(
  supabase: SupabaseClient,
  bucket: string,
  storagePaths: string[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(storagePaths, ttlSeconds);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}

/**
 * Back-compat shim for existing call sites that sign property-photos URLs.
 * New code should call `signStorageUrls` directly.
 */
export function signPhotoUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<Record<string, string>> {
  return signStorageUrls(supabase, "property-photos", storagePaths, ttlSeconds);
}
