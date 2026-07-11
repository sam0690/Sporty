"use client";

import { MyTeamView, useMyTeamDashboard } from "@/features/my-team";

export default function MyTeamPage() {
  const viewModel = useMyTeamDashboard();
  return <MyTeamView {...viewModel} />;
}
