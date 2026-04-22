import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const UuidSchema = z.string().uuid();

/**
 * First path segment must be a property_id the user owns (property-references layout).
 */
export async function userOwnsStoragePathPrefix(
  supabase: SupabaseClient,
  ownerId: string,
  storagePath: string,
): Promise<boolean> {
  const segment = storagePath.split("/")[0] ?? "";
  const parsed = UuidSchema.safeParse(segment);
  if (!parsed.success) return false;

  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", parsed.data)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}
