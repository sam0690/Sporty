import type { Metadata } from "next";

import { PublicManagerProfileView } from "@/features/user-profile/components/PublicManagerProfileView";

export const metadata: Metadata = {
  title: "Manager Profile | Sporty",
  description: "Career fantasy points, league history, and rank — free to view, no account needed.",
};

export default async function PublicManagerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicManagerProfileView userId={id} />;
}
