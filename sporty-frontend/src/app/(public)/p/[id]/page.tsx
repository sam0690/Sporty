import type { Metadata } from "next";

import { PublicPlayerProfileView } from "@/components/shared/player-detail/PublicPlayerProfileView";
import { idFromSlug } from "@/utils/profileSlug";

export const metadata: Metadata = {
  title: "Player Profile | Sporty",
  description: "Fantasy stats, form, and recent performance — free to view, no account needed.",
};

export default async function PublicPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicPlayerProfileView playerId={idFromSlug(id)} />;
}
