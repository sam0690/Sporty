import LiveMatchClient from "@/components/live/LiveMatchClient";

type MatchPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params;
  return <LiveMatchClient matchId={matchId} />;
}
