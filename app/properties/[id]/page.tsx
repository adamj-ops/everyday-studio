export const metadata = { title: "Property — Everyday Studio" };

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Property {id}</h1>
      <p className="text-muted-foreground mt-2">
        TODO(session-4): property setup form, photo upload, room list.
      </p>
    </div>
  );
}
