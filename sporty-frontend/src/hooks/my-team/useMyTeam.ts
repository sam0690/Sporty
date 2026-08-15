"use client";

import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import type { TLeague } from "@/types/league";

export function useUserLeagues() {
  return useMyLeagues();
}

// Re-export, not a second implementation: this used to be a separate hook
// publishing the same ["leagues", id, "my-team"] key with a different fetcher
// and staleTime, so which one won depended on mount order.
export { useMyTeam } from "@/hooks/leagues/useLeagues";

export function getLeagueDisplayName(league: TLeague) {
  return league.my_team?.name
    ? `${league.name} · ${league.my_team.name}`
    : league.name;
}
