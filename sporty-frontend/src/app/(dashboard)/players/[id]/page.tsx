import { PlayerDetailPageView } from "@/components/shared/player-detail/PlayerDetailPageView";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerDetailPageView playerId={id} />;
}
