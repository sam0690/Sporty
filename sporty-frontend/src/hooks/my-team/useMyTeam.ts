"use client";

import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { TeamService } from "@/services/TeamService";
import type { TFantasyTeam, TLeague } from "@/types/league";

export function useUserLeagues() {
  return useMyLeagues();
}

export function useMyTeam(leagueId: string | null | undefined) {
  return useApiQuery<TFantasyTeam | null>(
    ["leagues", leagueId ?? "", "my-team"],
    ({ signal }) => TeamService.getMyTeam(leagueId ?? "", signal),
    {
      enabled: Boolean(leagueId),
      staleTime: 60_000,
    },
  );
}

export function getLeagueDisplayName(league: TLeague) {
  return league.my_team?.name
    ? `${league.name} · ${league.my_team.name}`
    : league.name;
}
