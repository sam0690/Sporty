"use client";

import { MyTeamView, useMyTeamDashboard } from "@/features/my-team";

export function MyTeam() {
  const viewModel = useMyTeamDashboard();

  return <MyTeamView {...viewModel} />;
}
