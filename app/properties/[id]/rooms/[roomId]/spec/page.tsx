export const metadata = { title: "Spec Builder — Everyday Studio" };

export default async function SpecBuilderPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Spec Builder · property {id} · room {roomId}
      </h1>
      <p className="text-muted-foreground mt-2">
        TODO(session-5): structured spec form per room_type, field-level Suggest
        buttons via /api/claude/suggest-spec, autosave, lock flow.
      </p>
    </div>
  );
}
