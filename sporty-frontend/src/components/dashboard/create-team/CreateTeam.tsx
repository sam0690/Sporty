"use client";

import { CreateTeamView, useCreateTeamDashboard } from "@/features/create-team";

export function CreateTeam(props: { leagueId?: string } = {}) {
  const vm = useCreateTeamDashboard();
  return <CreateTeamView {...vm} {...props} />;
}
