import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomSpecSchema, type RoomSpec } from "@/lib/specs/schema";
import { getEmptySpec } from "@/lib/specs/defaults";
import { RoomSpecForm } from "@/components/room-spec-form";

export const metadata = { title: "Spec Builder — Everyday Studio" };

export default async function SpecBuilderPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  const supabase = await createClient();

  const [roomResult, propertyResult, latestSpecResult] = await Promise.all([
    supabase.from("rooms").select("id, room_type, label, property_id").eq("id", roomId).maybeSingle(),
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("room_specs")
      .select("id, version, spec_json, created_at")
      .eq("room_id", roomId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (roomResult.error || !roomResult.data) notFound();
  if (propertyResult.error || !propertyResult.data) notFound();
  if (roomResult.data.property_id !== id) notFound();

  const room = roomResult.data as {
    id: string;
    room_type: RoomSpec["room_type"];
    label: string;
    property_id: string;
  };
  const property = propertyResult.data;
  const latestSpec = latestSpecResult.data;

  let initialSpec: RoomSpec;
  let initialVersion: number | null = null;
  if (latestSpec) {
    const parsed = RoomSpecSchema.safeParse(latestSpec.spec_json);
    if (parsed.success) {
      initialSpec = parsed.data;
      initialVersion = latestSpec.version;
    } else {
      // Stored spec doesn't parse — schema drift. Warn loudly and fall back.
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Spec Builder</h1>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            Stored spec v{latestSpec.version} doesn&apos;t parse against the current schema.
            This usually means the schema changed since the spec was saved.
            Paste the raw JSON to migrate, or start a fresh spec.
          </div>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(latestSpec.spec_json, null, 2)}
          </pre>
          <Link
            href={`/properties/${id}`}
            className="text-sm underline underline-offset-4"
          >
            Back to property
          </Link>
        </div>
      );
    }
  } else {
    initialSpec = getEmptySpec(room.room_type, room.label);
  }

  return (
    <div className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        {" / "}
        <Link href={`/properties/${id}`} className="hover:underline">
          {property.address}
        </Link>
        {" / "}
        <span>{room.label}</span>
      </nav>
      <RoomSpecForm
        roomId={room.id}
        roomName={room.label}
        roomType={room.room_type}
        initialSpec={initialSpec}
        initialVersion={initialVersion}
      />
    </div>
  );
}
