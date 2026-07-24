import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompetitionView } from "@/features/competitions/CompetitionView";

const VALID = new Set(["epl", "laliga", "bundesliga"]);
const NAMES: Record<string, string> = {
  epl: "Premier League",
  laliga: "La Liga",
  bundesliga: "Bundesliga",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const name = NAMES[tag.toLowerCase()] ?? "Competition";
  return {
    title: `${name} — Standings, Fixtures & Stats | Sporty`,
    description: `${name} league table, fixtures, results and top scorers. Free to browse — no account needed.`,
  };
}

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const normalized = tag.toLowerCase();
  if (!VALID.has(normalized)) notFound();
  // Backend keys on the uppercase tag ("EPL"|"LALIGA"|"BUNDESLIGA").
  return <CompetitionView tag={normalized.toUpperCase()} />;
}
