"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { TransfersView } from "@/features/transfers";
import { useTransfersDashboard } from "@/features/transfers/hooks/useTransfersDashboard";
import { useLeague } from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";

export default function LeagueTransfersPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const router = useRouter();

  const { data: league } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const vm = useTransfersDashboard(leagueId);

  // Budget-mode-only page: draft leagues manage their squad through
  // free-agents/waivers/trades instead.
  useEffect(() => {
    if (isDraftMode) {
      router.replace(`/leagues/${leagueId}/free-agents`);
    }
  }, [isDraftMode, leagueId, router]);

  if (isDraftMode) {
    return null;
  }

  return <TransfersView {...vm} />;
}
