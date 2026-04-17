export const metadata = { title: "Mockup Studio — Everyday Studio" };

export default async function MockupStudioPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Mockup Studio · property {id} · room {roomId}
      </h1>
      <p className="text-muted-foreground mt-2">
        TODO(session-6): three-panel layout (spec sidebar, render canvas,
        review notes), references panel, generate flow (Sonnet → Opus → Gemini
        → Opus), conversational text-input edits.
      </p>
    </div>
  );
}
