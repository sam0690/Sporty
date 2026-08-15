import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { CompetitionView } from "@/features/competitions/CompetitionView";
import { publicFetch } from "@/services/server/publicFetch";
import type {
  TCompetitionsIndex,
  TStandingsResponse,
} from "@/types/competition";

const VALID = new Set(["epl", "laliga", "bundesliga", "ucl"]);
const NAMES: Record<string, string> = {
  epl: "Premier League",
  laliga: "La Liga",
  bundesliga: "Bundesliga",
  ucl: "Champions League",
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
  const upper = normalized.toUpperCase();

  // CompetitionView opens on the standings tab with season=undefined, so
  // these two keys are exactly what it asks for on first render. Both are
  // unauthenticated and identical for every visitor, and the underlying
  // snapshots refresh every 6h — so the server fetch is shared and cheap.
  const queryClient = new QueryClient();
  const [index, standings] = await Promise.all([
    publicFetch<TCompetitionsIndex>("/competitions", {}, 300),
    publicFetch<TStandingsResponse>(`/competitions/${upper}/standings`, {}, 300),
  ]);

  if (index) queryClient.setQueryData(["competitions", "index"], index);
  if (standings) {
    queryClient.setQueryData(
      ["competitions", upper, "standings", "current"],
      standings,
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompetitionView tag={upper} />
    </HydrationBoundary>
  );
}
