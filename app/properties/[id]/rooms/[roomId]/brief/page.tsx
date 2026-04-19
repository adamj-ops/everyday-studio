import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BriefForm } from "@/components/brief/brief-form";
import { signStorageUrls } from "@/lib/supabase/signed-urls";
import type { RoomBriefRow } from "@/lib/briefs/schema";

export const metadata = { title: "Room brief — Everyday Studio" };

export default async function RoomBriefPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id: propertyId, roomId } = await params;
  const supabase = await createClient();

  const [propertyResult, roomResult, briefResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, address")
      .eq("id", propertyId)
      .maybeSingle(),
    supabase
      .from("rooms")
      .select("id, property_id, room_type, label")
      .eq("id", roomId)
      .maybeSingle(),
    supabase
      .from("room_briefs")
      .select(
        "id, room_id, version, creative_answers, non_negotiables, category_moodboards, created_at, updated_at",
      )
      .eq("room_id", roomId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (propertyResult.error || !propertyResult.data) notFound();
  if (roomResult.error || !roomResult.data) notFound();
  if (roomResult.data.property_id !== propertyId) notFound();

  const brief = (briefResult.data as RoomBriefRow | null) ?? null;

  // Pre-sign all moodboard image URLs server-side so the initial render has
  // thumbnails without a client round-trip.
  let initialSignedUrls: Record<string, string> = {};
  if (brief) {
    const paths = brief.category_moodboards.flatMap((cm) => cm.image_storage_paths);
    if (paths.length > 0) {
      try {
        initialSignedUrls = await signStorageUrls(supabase, "property-references", paths);
      } catch {
        initialSignedUrls = {};
      }
    }
  }

  return (
    <BriefForm
      roomId={roomId}
      propertyId={propertyId}
      propertyAddress={propertyResult.data.address}
      roomType={roomResult.data.room_type}
      roomLabel={roomResult.data.label}
      initialBrief={brief}
      initialSignedUrls={initialSignedUrls}
    />
  );
}
