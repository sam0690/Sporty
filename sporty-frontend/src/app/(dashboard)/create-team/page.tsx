"use client";

import { CreateTeamView, useCreateTeamDashboard } from "@/features/create-team";

export default function CreateTeamPage() {
  const vm = useCreateTeamDashboard();
  return <CreateTeamView {...vm} />;
}
