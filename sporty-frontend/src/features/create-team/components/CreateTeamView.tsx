"use client";

import { DraftRoom } from "./DraftRoom";
import { BudgetTeamBuilder } from "./BudgetTeamBuilder";
import type { CreateTeamViewModel } from "../hooks/useCreateTeamDashboard";

type CreateTeamProps = Record<string, unknown> & { leagueId?: string };

export function CreateTeamView(
  props: CreateTeamProps & Partial<CreateTeamViewModel> = {},
) {
  const { league, leagueLoading, isDraftLeague } = props as CreateTeamViewModel;

  if (leagueLoading || !league) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-sm text-fg-3">
        Loading team setup...
      </section>
    );
  }

  const vm = { ...(props as CreateTeamViewModel), league };

  return isDraftLeague ? <DraftRoom {...vm} /> : <BudgetTeamBuilder {...vm} />;
}
