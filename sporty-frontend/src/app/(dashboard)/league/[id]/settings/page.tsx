import { redirect } from "next/navigation";

type LeagueSettingsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueSettingsPage({
  params,
}: LeagueSettingsPageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}/settings`);
}
