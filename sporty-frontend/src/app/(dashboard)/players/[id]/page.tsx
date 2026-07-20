import { PlayerDetailPageView } from "@/components/shared/player-detail/PlayerDetailPageView";
import { idFromSlug } from "@/utils/profileSlug";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerDetailPageView playerId={idFromSlug(id)} />;
}
