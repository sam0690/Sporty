import { redirect } from "next/navigation";

type LeagueRosterPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueRosterPage({
  params,
}: LeagueRosterPageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}/lineup`);
}
