import { PlayerDetailModalRoute } from "@/components/shared/player-detail/PlayerDetailModalRoute";
import { idFromSlug } from "@/utils/profileSlug";

export default async function InterceptedPlayerDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerDetailModalRoute playerId={idFromSlug(id)} />;
}
