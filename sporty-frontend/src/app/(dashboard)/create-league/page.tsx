"use client";

import {
  CreateLeagueView,
  useCreateLeagueDashboard,
} from "@/features/create-league";

export default function CreateLeaguePage() {
  const vm = useCreateLeagueDashboard();
  return <CreateLeagueView {...vm} />;
}
