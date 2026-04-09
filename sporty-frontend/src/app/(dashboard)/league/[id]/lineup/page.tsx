import { redirect } from "next/navigation";

type LeagueLineupPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueLineupPage({
  params,
}: LeagueLineupPageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}/lineup`);
}
