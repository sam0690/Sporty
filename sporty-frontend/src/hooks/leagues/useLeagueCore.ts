/**
 * League CRUD, membership, seasons/renewal, sports, settings, transfer windows.
 *
 * Split from the former 848-line useLeagues.ts; that file re-exports
 * everything, so existing imports keep working.
 */
import {
  useQueries,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useApiQuery } from "../api/useApiQuery";
import { useApiMutation } from "../api/useApiMutation";
import { LeagueService } from "@/services/LeagueService";
import {
  TCompetitionType,
  TLeague,
  TMembership,
  TSeason,
  TSport,
  TFantasyTeam,
  TTransfer,
  TUserTransferLeagueGroup,
  TLineupUpdateRequest,
  TLineupResponse,
  TLeaderboardResponse,
  TGameweekRecapResponse,
  TTransferWindow,
  TDraftPick,
  TStageOutRequest,
  TStageOutResponse,
  TStageInRequest,
  TStageInResponse,
  TConfirmTransfersRequest,
  TConfirmTransfersResponse,
  TDraftTurn,
  TDiscardPlayerResponse,
  TFreeAgentPage,
  TFreeAgentClaimResponse,
  TWaiverClaim,
  TWaiverOrderEntry,
  TLeagueRoster,
  TTradeOffer,
  TTradeFairness,
  TPowerRankingEntry,
  TMatchup,
  TH2HStandingRow,
  TSeasonHistoryItem,
} from "@/types";
import { toastifier } from "@/lib/toastifier";
import { isApiError } from "@/utils/api-Error";


/**
 * Hook to fetch all active seasons.
 */
export function useSeasons() {
  return useApiQuery<TSeason[]>(["seasons"], () => LeagueService.getSeasons());
}

/**
 * Hook to fetch all active sports.
 */
export function useSports() {
  return useApiQuery<TSport[]>(["sports"], () => LeagueService.getSports());
}

export const useMyLeagues = () => {
  return useApiQuery<TLeague[]>(["leagues", "me"], () =>
    LeagueService.getMyLeagues(),
  );
};

export const useDiscoverLeagues = () => {
  return useApiQuery<TLeague[]>(["leagues", "discover"], () =>
    LeagueService.discoverLeagues(),
  );
};

export const useLeague = (id: string) => {
  return useApiQuery<TLeague>(
    ["leagues", id],
    () => LeagueService.getLeague(id),
    {
      enabled: !!id,
    },
  );
};

/**
 * Hook to fetch the current user's fantasy team in a league.
 */
export function useMyTeam(id: string) {
  return useApiQuery<TFantasyTeam>(
    ["leagues", id, "my-team"],
    ({ signal }) => LeagueService.getMyTeam(id, signal),
    {
      enabled: !!id,
    },
  );
}

export function useMyTeamsForLeagues(leagueIds: string[]) {
  return useQueries({
    queries: leagueIds.map((leagueId) => ({
      queryKey: ["leagues", leagueId, "my-team"],
      queryFn: ({ signal }) => LeagueService.getMyTeam(leagueId, signal),
      enabled: !!leagueId,
    })),
  });
}

export function useCreateLeague() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (payload: {
      name: string;
      season_id: string;
      sports?: string[];
      competitionType?: TCompetitionType;
      is_public?: boolean;
      max_teams?: number;
      squad_size?: number;
      budget_per_team?: number;
      draft_mode?: boolean;
      draft_pick_seconds?: number;
      is_head_to_head?: boolean;
      allow_midseason_join?: boolean;
      transfers_per_window?: number;
    }) => LeagueService.createLeague(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues"] });
      },
      successMessage: "League created successfully!",
    },
  );
}

/**
 * Hook to build initial team in a budget-mode league.
 */
export function useBuildTeam() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        team_name: string;
        player_ids: string[];
      };
    }) => LeagueService.buildTeam(id, payload),
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["leagues", variables.id] });
        queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
        queryClient.invalidateQueries({
          queryKey: ["leagues", variables.id, "my-team"],
        });
        queryClient.invalidateQueries({ queryKey: ["players"] });
      },
      successMessage: "Team built successfully!",
    },
  );
}

export const useJoinLeague = () => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (inviteCode: string) => LeagueService.joinLeague(inviteCode),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
      },
      successMessage: "Joined league successfully!",
    },
  );
};

export const useLeaveLeague = () => {
  const queryClient = useQueryClient();
  return useApiMutation((id: string) => LeagueService.leaveLeague(id), {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
      queryClient.removeQueries({ queryKey: ["leagues", id] });
      queryClient.removeQueries({ queryKey: ["leagues", id, "my-team"] });
    },
    successMessage: "Left league successfully!",
  });
};

export const useDeleteLeague = () => {
  const queryClient = useQueryClient();
  return useApiMutation((id: string) => LeagueService.deleteLeague(id), {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
      queryClient.removeQueries({ queryKey: ["leagues", id] });
      queryClient.removeQueries({ queryKey: ["leagues", id, "my-team"] });
    },
    successMessage: "League deleted successfully!",
  });
};

export function useUpdateLeague(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (payload: { name?: string; is_public?: boolean }) =>
      LeagueService.updateLeague(leagueId, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
        queryClient.invalidateQueries({ queryKey: ["leagues", "discover"] });
      },
      successMessage: "League settings saved",
    },
  );
}

export function useLeagueMembers(leagueId: string) {
  return useApiQuery<TMembership[]>(
    ["leagues", leagueId, "members"],
    () => LeagueService.getMembers(leagueId),
    { enabled: !!leagueId },
  );
}

export function useKickMember(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (membershipId: string) => LeagueService.removeMember(leagueId, membershipId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "members"],
        });
        // member_count on the league changes too
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
      },
      successMessage: "Member removed from league",
    },
  );
}

export function useUpdateLeagueStatus(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (newStatus: "setup" | "drafting" | "active" | "completed") =>
      LeagueService.updateStatus(leagueId, newStatus),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
      },
      successMessage: "League status updated",
    },
  );
}

export function useRenewLeague(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (options: { targetSeasonId?: string; dynasty?: boolean } = {}) =>
      LeagueService.renewLeague(leagueId, options),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId, "seasons"] });
        queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
      },
      successMessage: "Next season started!",
    },
  );
}

export function useSeasonHistory(leagueId: string) {
  return useApiQuery<TSeasonHistoryItem[]>(
    ["leagues", leagueId, "seasons"],
    () => LeagueService.getSeasonHistory(leagueId),
    {
      enabled: !!leagueId,
    },
  );
}

export function useUpdateMidseasonJoin(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (allowMidseasonJoin: boolean) =>
      LeagueService.updateMidseasonJoin(leagueId, allowMidseasonJoin),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({ queryKey: ["leagues", "discover"] });
      },
      successMessage: "Mid-season join setting updated",
    },
  );
}

export function useAddLeagueSport(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (sportName: string) => LeagueService.addSport(leagueId, sportName),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
      },
      successMessage: "Sport added to league",
    },
  );
}

export function useRemoveLeagueSport(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (sportName: string) => LeagueService.removeSport(leagueId, sportName),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
      },
      successMessage: "Sport removed from league",
    },
  );
}

export function useRemapSportSeason(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ sportName, seasonId }: { sportName: string; seasonId: string }) =>
      LeagueService.remapSportSeason(leagueId, sportName, seasonId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
      },
      successMessage: "Season mapping updated",
    },
  );
}

export function useActiveWindow(
  leagueId: string,
  options?: Omit<
    UseQueryOptions<TTransferWindow, Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useApiQuery<TTransferWindow>(
    ["leagues", leagueId, "active-window"],
    () => LeagueService.getActiveWindow(leagueId),
    {
      enabled: !!leagueId,
      ...options,
    },
  );
}

// The gameweek the user can currently SET UP (next not-yet-locked window).
// Lineup + transfers edit this while the in-progress window plays.
export function useEditableWindow(
  leagueId: string,
  options?: Omit<
    UseQueryOptions<TTransferWindow, Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useApiQuery<TTransferWindow>(
    ["leagues", leagueId, "editable-window"],
    () => LeagueService.getEditableWindow(leagueId),
    {
      enabled: !!leagueId,
      ...options,
    },
  );
}
