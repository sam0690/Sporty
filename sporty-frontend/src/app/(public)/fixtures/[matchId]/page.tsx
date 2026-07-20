import LiveMatchClient from "@/components/live/LiveMatchClient";

type FixtureDetailProps = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicFixtureDetailPage({
  params,
  searchParams,
}: FixtureDetailProps) {
  const { matchId } = await params;
  const { tab } = await searchParams;
  return (
    <LiveMatchClient
      matchId={matchId}
      initialTab={typeof tab === "string" ? tab : undefined}
    />
  );
}
