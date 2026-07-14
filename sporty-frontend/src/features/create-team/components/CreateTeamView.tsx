"use client";

import { useParams } from "next/navigation";
import { ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/ui/skeletons";
import { useLeague } from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import { DraftRoom } from "./DraftRoom";
import { BudgetTeamBuilder } from "./BudgetTeamBuilder";
import { useCreateTeamDashboard } from "../hooks/useCreateTeamDashboard";

// Separate component so budget-mode state (form, selection, market) only
// mounts for budget leagues — draft leagues never run these queries.
function BudgetTeamBuilderRoute() {
  const vm = useCreateTeamDashboard();
  if (!vm.league) {
    return null; // parent gates on league; this only bridges the type
  }
  return <BudgetTeamBuilder {...vm} league={vm.league} />;
}

export function CreateTeamView() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const { data: league, isLoading, isError } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl space-y-4 px-6 py-8">
        <CardSkeleton />
        <CardSkeleton />
      </section>
    );
  }

  if (isError || !league) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        <ErrorState title="Failed to load league" />
      </section>
    );
  }

  return isDraftMode ? <DraftRoom league={league} /> : <BudgetTeamBuilderRoute />;
}
