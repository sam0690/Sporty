import { useMemo } from "react";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { LeagueService } from "@/services/LeagueService";
import { UserService, type TUserActivityItem } from "@/services/UserService";

export type DashboardPitchPlayer = {
  id: string;
  name: string;
  position: string;
  sportName: string;
  points: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type DashboardLeagueTeamPreview = {
  leagueId: string;
  leagueName: string;
  gameweek: number | null;
  players: DashboardPitchPlayer[];
};

export function useDashboardTeamPreview(selectedLeagueId?: string | null) {
  const leaguesQuery = useMyLeagues();
  const activeLeague = useMemo(
    () =>
      (leaguesQuery.data ?? []).find(
        (league) => league.id === selectedLeagueId,
      ) ??
      (leaguesQuery.data ?? [])[0] ??
      null,
    [leaguesQuery.data, selectedLeagueId],
  );

  const lineupQuery = useApiQuery(
    ["leagues", activeLeague?.id, "lineup"],
    () => LeagueService.getLineup(activeLeague!.id),
    { enabled: Boolean(activeLeague?.id) },
  );

  const windowQuery = useApiQuery(
    ["leagues", activeLeague?.id, "active-window"],
    () => LeagueService.getActiveWindow(activeLeague!.id),
    { enabled: Boolean(activeLeague?.id) },
  );

  const previews = useMemo<DashboardLeagueTeamPreview[]>(() => {
    if (!activeLeague || !lineupQuery.data) {
      return [];
    }

    const players: DashboardPitchPlayer[] = lineupQuery.data.starting_lineup
      .map((entry) => ({
        id: entry.player.id,
        name: entry.player.name,
        position: entry.player.position,
        sportName: entry.player.sport.name,
        points: null,
        isCaptain: entry.is_captain,
        isViceCaptain: entry.is_vice_captain,
      }))
      .sort((a, b) => {
        const priority = (position: string) => {
          const upper = position.toUpperCase();
          if (upper.includes("GK") || upper === "G") return 0;
          if (upper.includes("DEF") || upper === "D") return 1;
          if (upper.includes("MID") || upper === "M") return 2;
          if (upper.includes("FWD") || upper.includes("ATT") || upper === "F")
            return 3;
          return 4;
        };

        return priority(a.position) - priority(b.position);
      });

    return [
      {
        leagueId: activeLeague.id,
        leagueName: activeLeague.name,
        gameweek: windowQuery.data?.number ?? null,
        players,
      },
    ];
  }, [activeLeague, lineupQuery.data, windowQuery.data]);

  return {
    previews,
    selectedLeague: activeLeague,
    hasLeagues: (leaguesQuery.data?.length ?? 0) > 0,
    isLoading:
      leaguesQuery.isLoading ||
      (Boolean(activeLeague?.id) &&
        (lineupQuery.isLoading || windowQuery.isLoading)),
    error: leaguesQuery.error || lineupQuery.error || windowQuery.error || null,
  };
}

export function useDashboardLeagueStats(selectedLeagueId?: string | null) {
  return useApiQuery(
    ["leagues", selectedLeagueId, "dashboard-stats"],
    () => LeagueService.getDashboardStats(selectedLeagueId!),
    { enabled: Boolean(selectedLeagueId) },
  );
}

export function useRecentActivity(selectedLeagueId?: string | null) {
  return useApiQuery<TUserActivityItem[]>(
    ["users", "me", "activity", selectedLeagueId ?? "all"],
    () => UserService.getMyActivity(selectedLeagueId ?? undefined),
    {
      enabled: Boolean(selectedLeagueId),
    },
  );
}
