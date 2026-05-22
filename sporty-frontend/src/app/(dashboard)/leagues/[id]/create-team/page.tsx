import { redirect } from "next/navigation";

type LeagueCreateTeamPageProps = {
  params: {
    id: string;
  };
};

export default function LeagueCreateTeamPage({
  params,
}: LeagueCreateTeamPageProps) {
  redirect(`/create-team?leagueId=${params.id}`);
}
