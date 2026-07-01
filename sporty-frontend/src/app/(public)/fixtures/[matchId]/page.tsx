import LiveMatchClient from "@/components/live/LiveMatchClient";

type FixtureDetailProps = {
  params: Promise<{ matchId: string }>;
};

export default async function PublicFixtureDetailPage({
  params,
}: FixtureDetailProps) {
  const { matchId } = await params;
  return <LiveMatchClient matchId={matchId} />;
}
