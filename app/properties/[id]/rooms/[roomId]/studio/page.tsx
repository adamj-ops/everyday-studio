import { redirect } from "next/navigation";

export default async function LegacyRoomStudioPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  redirect(`/properties/${id}/spaces/${roomId}/studio`);
}
