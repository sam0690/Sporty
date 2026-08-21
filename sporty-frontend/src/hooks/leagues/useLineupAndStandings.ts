/**
 * Weekly lineup + leaderboard + gameweek recap.
 *
 * Split from the former 848-line useLeagues.ts; that file re-exports
 * everything, so existing imports keep working.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "../api/useApiQuery";
import { useApiMutation } from "../api/useApiMutation";
import { LeagueService } from "@/services/LeagueService";
import {
  TLineupUpdateRequest,
  TLineupResponse,
  TLeaderboardResponse,
  TGameweekRecapResponse,
} from "@/types";
import { toastifier } from "@/lib/toastifier";
import {
  refreshActiveWindow,
  shouldRefreshActiveWindow,
} from "./windowRefresh";


export const useLineup = (leagueId: string) => {
  return useApiQuery(
    ["leagues", leagueId, "lineup"],
    () => LeagueService.getLineup(leagueId),
    { enabled: !!leagueId },
  );
};

export function useUpdateLineup(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TLineupResponse, TLineupUpdateRequest>(
    (data) => LeagueService.updateLineup(leagueId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "lineup"],
        });
        // The dashboard's team preview reads "live-lineup", a different key
        // from "lineup" — without this it showed the pre-save XI until its
        // staleTime expired.
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "live-lineup"],
        });
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "dashboard-stats"],
        });
        void refreshActiveWindow(queryClient, leagueId);
        toastifier.success("Lineup saved successfully");
      },
      onError: (error) => {
        if (shouldRefreshActiveWindow(error)) {
          void refreshActiveWindow(queryClient, leagueId);
        }
      },
    },
  );
}

export function useLeaderboard(
  leagueId: string,
  windowId?: string,
  historical = true,
  gameweek?: number,
) {
  return useApiQuery<TLeaderboardResponse>(
    ["leagues", leagueId, "leaderboard", windowId, historical, gameweek],
    () =>
      LeagueService.getLeaderboard(
        leagueId,
        windowId ?? undefined,
        historical,
        gameweek,
      ),
    { enabled: !!leagueId },
  );
}

export function useGameweekRecap(
  leagueId: string,
  gameweek?: number,
  windowId?: string,
) {
  return useApiQuery<TGameweekRecapResponse>(
    ["leagues", leagueId, "gameweek-recap", windowId ?? null, gameweek ?? null],
    () => LeagueService.getGameweekRecap(leagueId, windowId, gameweek),
    { enabled: !!leagueId },
  );
}
