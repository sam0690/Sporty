"use client";

import {
  CreateLeagueView,
  useCreateLeagueDashboard,
} from "@/features/create-league";

export function CreateLeague() {
  const vm = useCreateLeagueDashboard();
  return <CreateLeagueView {...vm} />;
}
