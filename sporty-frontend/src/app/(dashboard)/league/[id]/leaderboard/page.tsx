import { redirect } from "next/navigation";

type LeagueLeaderboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueLeaderboardPage({
  params,
}: LeagueLeaderboardPageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}/leaderboard`);
}
