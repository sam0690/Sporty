"use client";

import { JoinLeagueView, useJoinLeagueDashboard } from "@/features/join-league";

export function JoinLeague() {
  const vm = useJoinLeagueDashboard();
  return <JoinLeagueView {...vm} />;
}
