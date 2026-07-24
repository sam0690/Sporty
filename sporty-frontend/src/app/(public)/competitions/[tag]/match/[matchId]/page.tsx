import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompetitionMatchDetail } from "@/features/competitions/CompetitionMatchDetail";

const VALID = new Set(["ucl"]); // display-only competitions with detail pages

export const metadata: Metadata = {
  title: "Match | Sporty",
};

export default async function CompetitionMatchPage({
  params,
}: {
  params: Promise<{ tag: string; matchId: string }>;
}) {
  const { tag, matchId } = await params;
  if (!VALID.has(tag.toLowerCase())) notFound();
  return <CompetitionMatchDetail tag={tag} matchId={matchId} />;
}
