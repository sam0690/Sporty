import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { LeagueService } from "@/services/LeagueService";
import { UserService, type TUserActivityItem } from "@/services/UserService";
import type { TLeagueDashboardStats } from "@/types/league";
import {
  normalizeSport,
  type SportKind,
} from "@/lib/formation/sportRegistry";

export type DashboardPitchPlayer = {
  id: string;
  name: string;
  position: string;
  sport: SportKind;
  team?: string;
  photoUrl?: string | null;
  points: number | null;
  isStarter: boolean;
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

  // Dashboard preview shows the gameweek that's actually playing right now,
  // not the upcoming one being set up — both the roster and the badge number
  // must come from the same (live) window, or they can point to different
  // gameweeks. starting_lineup comes back empty when no window is live
  // (e.g. between gameweeks).
  // keepPreviousData across all the league-keyed queries: switching leagues
  // keeps the previous league's content on screen (dimmed by the caller via
  // isSwitching) instead of collapsing to skeletons — skeletons are for the
  // true first load only.
  const lineupQuery = useApiQuery(
    ["leagues", activeLeague?.id, "live-lineup"],
    () => LeagueService.getLiveLineup(activeLeague!.id),
    { enabled: Boolean(activeLeague?.id), placeholderData: keepPreviousData },
  );

  const windowQuery = useApiQuery(
    ["leagues", activeLeague?.id, "active-window"],
    () => LeagueService.getActiveWindow(activeLeague!.id),
    { enabled: Boolean(activeLeague?.id), placeholderData: keepPreviousData },
  );

  const previews = useMemo<DashboardLeagueTeamPreview[]>(() => {
    if (!activeLeague || !lineupQuery.data) {
      return [];
    }

    const players: DashboardPitchPlayer[] =
      lineupQuery.data.starting_lineup.map((entry) => ({
        id: entry.player.id,
        name: entry.player.name,
        position: entry.player.position,
        sport: normalizeSport(entry.player.sport.name),
        team: entry.player.real_team ?? undefined,
        photoUrl: entry.player.photo_url ?? null,
        points: null,
        isStarter: true,
        isCaptain: entry.is_captain,
        isViceCaptain: entry.is_vice_captain,
      }));

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
    // True while showing the previous league's data during a switch.
    isSwitching: lineupQuery.isPlaceholderData || windowQuery.isPlaceholderData,
    error: leaguesQuery.error || lineupQuery.error || windowQuery.error || null,
    // Refetch every query the preview depends on — wired to the card's retry.
    refetch: () =>
      Promise.all([
        leaguesQuery.refetch(),
        lineupQuery.refetch(),
        windowQuery.refetch(),
      ]),
  };
}

export function useDashboardLeagueStats(selectedLeagueId?: string | null) {
  return useApiQuery<TLeagueDashboardStats>(
    ["leagues", selectedLeagueId, "dashboard-stats"],
    () => LeagueService.getDashboardStats(selectedLeagueId!),
    { enabled: Boolean(selectedLeagueId), placeholderData: keepPreviousData },
  );
}

export function useRecentActivity(selectedLeagueId?: string | null) {
  return useApiQuery<TUserActivityItem[]>(
    ["users", "me", "activity", selectedLeagueId ?? "all"],
    () => UserService.getMyActivity(selectedLeagueId ?? undefined),
    {
      enabled: Boolean(selectedLeagueId),
      placeholderData: keepPreviousData,
    },
  );
}
