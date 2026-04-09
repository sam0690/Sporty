import { redirect } from "next/navigation";

type LeagueInvitePageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueInvitePage({
  params,
}: LeagueInvitePageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}/invite`);
}
