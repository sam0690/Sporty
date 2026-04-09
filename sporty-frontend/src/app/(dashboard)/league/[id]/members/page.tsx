import { redirect } from "next/navigation";

type LeagueMembersPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeagueMembersPage({
  params,
}: LeagueMembersPageProps) {
  const { id } = await params;
  redirect(`/leagues/${id}/members`);
}
