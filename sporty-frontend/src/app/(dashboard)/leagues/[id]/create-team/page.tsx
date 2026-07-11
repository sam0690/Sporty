"use client";

import { CreateTeamView, useCreateTeamDashboard } from "@/features/create-team";

export default function LeagueCreateTeamPage() {
  const vm = useCreateTeamDashboard();
  return <CreateTeamView {...vm} />;
}
