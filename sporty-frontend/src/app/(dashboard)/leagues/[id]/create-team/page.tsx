import { redirect } from "next/navigation";

type LeagueCreateTeamPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueCreateTeamPage({
  params,
}: LeagueCreateTeamPageProps) {
  const { id } = await params;
  redirect(`/create-team?leagueId=${id}`);
}
