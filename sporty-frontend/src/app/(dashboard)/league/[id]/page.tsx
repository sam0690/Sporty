import { redirect } from "next/navigation";

type LeaguePageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueHomePage({ params }: LeaguePageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}`);
}
