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
      allow_midseason_join?: boolean;
      transfers_per_window?: number;
      transfer_day?: number;
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

export const useStartDraft = () => {
  const queryClient = useQueryClient();
  return useApiMutation((id: string) => LeagueService.startDraft(id), {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["leagues", id] });
      queryClient.invalidateQueries({ queryKey: ["leagues", id, "my-team"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    successMessage: "Draft started!",
  });
};

export const useMakeDraftPick = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<TDraftPick, string>(
    (playerId: string) => LeagueService.makeDraftPick(leagueId, playerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
        queryClient.invalidateQueries({ queryKey: ["players"] });
      },
      successMessage: "Draft pick submitted!",
    },
  );
};

export const useDraftTurn = (leagueId: string, enabled = true) => {
  return useApiQuery<TDraftTurn>(
    ["leagues", leagueId, "draft-turn"],
    () => LeagueService.getDraftTurn(leagueId),
    {
      enabled: !!leagueId && enabled,
      refetchInterval: 3000,
    },
  );
};

export const useFreeAgents = (
  leagueId: string,
  opts?: { position?: string; search?: string; limit?: number; offset?: number },
  enabled = true,
) => {
  return useApiQuery<TFreeAgentPage>(
    ["leagues", leagueId, "free-agents", opts ?? {}],
    () => LeagueService.getFreeAgents(leagueId, opts),
    { enabled: !!leagueId && enabled },
  );
};

export const useClaimFreeAgent = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<
    TFreeAgentClaimResponse,
    { addPlayerId: string; dropPlayerId: string }
  >(
    ({ addPlayerId, dropPlayerId }) =>
      LeagueService.claimFreeAgent(leagueId, addPlayerId, dropPlayerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "free-agents"],
        });
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
      },
      successMessage: "Roster move complete!",
    },
  );
};

export const useWaiverClaims = (leagueId: string, enabled = true) => {
  return useApiQuery<TWaiverClaim[]>(
    ["leagues", leagueId, "waivers"],
    () => LeagueService.getWaiverClaims(leagueId),
    { enabled: !!leagueId && enabled },
  );
};

export const useWaiverOrder = (leagueId: string, enabled = true) => {
  return useApiQuery<TWaiverOrderEntry[]>(
    ["leagues", leagueId, "waiver-order"],
    () => LeagueService.getWaiverOrder(leagueId),
    { enabled: !!leagueId && enabled },
  );
};

export const useSubmitWaiverClaim = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<
    TWaiverClaim,
    { addPlayerId: string; dropPlayerId: string }
  >(
    ({ addPlayerId, dropPlayerId }) =>
      LeagueService.submitWaiverClaim(leagueId, addPlayerId, dropPlayerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "waivers"],
        });
      },
      successMessage: "Waiver claim submitted!",
    },
  );
};

export const useCancelWaiverClaim = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<TWaiverClaim, string>(
    (claimId: string) => LeagueService.cancelWaiverClaim(leagueId, claimId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "waivers"],
        });
      },
      successMessage: "Claim cancelled",
    },
  );
};

export const useReorderWaiverClaims = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<TWaiverClaim[], string[]>(
    (orderedClaimIds: string[]) =>
      LeagueService.reorderWaiverClaims(leagueId, orderedClaimIds),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "waivers"],
        });
      },
      successMessage: "Priority updated",
    },
  );
};

export const useTrades = (leagueId: string, enabled = true) => {
  return useApiQuery<TTradeOffer[]>(
    ["leagues", leagueId, "trades"],
    () => LeagueService.getTrades(leagueId),
    { enabled: !!leagueId && enabled },
  );
};

export const useTradeRosters = (leagueId: string, enabled = true) => {
  return useApiQuery<TLeagueRoster[]>(
    ["leagues", leagueId, "trade-rosters"],
    () => LeagueService.getTradeRosters(leagueId),
    { enabled: !!leagueId && enabled },
  );
};

export const useProposeTrade = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<
    { id: string; status: string },
    {
      to_team_id: string;
      offered_player_ids: string[];
      requested_player_ids: string[];
    }
  >((payload) => LeagueService.proposeTrade(leagueId, payload), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues", leagueId, "trades"] });
    },
    successMessage: "Trade proposed!",
  });
};

export const usePowerRankings = (leagueId: string, enabled = true) => {
  return useApiQuery<TPowerRankingEntry[]>(
    ["leagues", leagueId, "power-rankings"],
    () => LeagueService.getPowerRankings(leagueId),
    { enabled: !!leagueId && enabled },
  );
};

export const useTradeFairnessPreview = (
  leagueId: string,
  offeredPlayerIds: string[],
  requestedPlayerIds: string[],
  enabled = true,
) => {
  return useApiQuery<TTradeFairness>(
    [
      "leagues",
      leagueId,
      "trade-fairness-preview",
      [...offeredPlayerIds].sort(),
      [...requestedPlayerIds].sort(),
    ],
    () =>
      LeagueService.getTradeFairnessPreview(leagueId, {
        offered_player_ids: offeredPlayerIds,
        requested_player_ids: requestedPlayerIds,
      }),
    {
      enabled:
        !!leagueId &&
        enabled &&
        offeredPlayerIds.length > 0 &&
        requestedPlayerIds.length > 0,
    },
  );
};

export const useTradeAction = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation<
    { id: string; status: string },
    { tradeId: string; action: "accept" | "reject" | "cancel" | "veto" }
  >(({ tradeId, action }) => LeagueService.tradeAction(leagueId, tradeId, action), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues", leagueId, "trades"] });
      queryClient.invalidateQueries({ queryKey: ["leagues", leagueId, "my-team"] });
    },
    successMessage: "Trade updated",
  });
};

const ACTIVE_WINDOW_QUERY_KEY = (leagueId: string) => [
  "leagues",
  leagueId,
  "active-window",
];

const EDITABLE_WINDOW_QUERY_KEY = (leagueId: string) => [
  "leagues",
  leagueId,
  "editable-window",
];

const shouldRefreshActiveWindow = (error: unknown) =>
  isApiError(error) && (error.statusCode === 403 || error.statusCode === 409);

// Refetches BOTH the in-progress window and the editable (next) window.
// Mutations here (lineup, transfers) are gated by the editable window on
// screen, so that one must resync too, not just "active-window" — otherwise
// a save that lands right as the gameweek boundary rolls over leaves the UI
// pointed at a now-stale window while the backend has already moved on.
async function refreshActiveWindow(
  queryClient: ReturnType<typeof useQueryClient>,
  leagueId: string,
) {
  if (!leagueId) return;

  await Promise.all([
    queryClient.refetchQueries({
      queryKey: ACTIVE_WINDOW_QUERY_KEY(leagueId),
      exact: true,
    }),
    queryClient.refetchQueries({
      queryKey: EDITABLE_WINDOW_QUERY_KEY(leagueId),
      exact: true,
    }),
  ]);
}

/**
 * Hook to make a player transfer.
 */
export const useMakeTransfer = (leagueId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (payload: { player_in_id: string; player_out_id: string }) =>
      LeagueService.makeTransfer(leagueId, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({ queryKey: ["players"] });
        void refreshActiveWindow(queryClient, leagueId);
      },
      onError: (error) => {
        if (shouldRefreshActiveWindow(error)) {
          void refreshActiveWindow(queryClient, leagueId);
        }
      },
      successMessage: "Transfer completed successfully!",
    },
  );
};

export function useStageOut(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TStageOutResponse, TStageOutRequest>(
    (payload) => LeagueService.stageOut(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
        void refreshActiveWindow(queryClient, leagueId);
      },
      onError: (error) => {
        if (shouldRefreshActiveWindow(error)) {
          void refreshActiveWindow(queryClient, leagueId);
        }
      },
      successMessage: "Player staged out",
      silent: true,
    },
  );
}

export function useDiscardTeamPlayer(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TDiscardPlayerResponse, string>(
    (playerId: string) => LeagueService.discardTeamPlayer(leagueId, playerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
      },
      successMessage: "Player discarded",
      silent: true,
    },
  );
}

export function useStageIn(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TStageInResponse, TStageInRequest>(
    (payload) => LeagueService.stageIn(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
        void refreshActiveWindow(queryClient, leagueId);
      },
      onError: (error) => {
        if (shouldRefreshActiveWindow(error)) {
          void refreshActiveWindow(queryClient, leagueId);
        }
      },
      successMessage: "Player staged in",
      silent: true,
    },
  );
}

export function useConfirmTransfers(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TConfirmTransfersResponse, TConfirmTransfersRequest>(
    (payload) => LeagueService.confirmTransfers(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "my-team"],
        });
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
        queryClient.invalidateQueries({ queryKey: ["players"] });
        void refreshActiveWindow(queryClient, leagueId);
      },
      onError: (error) => {
        if (shouldRefreshActiveWindow(error)) {
          void refreshActiveWindow(queryClient, leagueId);
        }
      },
      successMessage: "Transfers confirmed",
      silent: true,
    },
  );
}

export function useCancelTransfers(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<void, void>(() => LeagueService.cancelTransfers(), {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["leagues", leagueId, "my-team"],
      });
    },
    successMessage: "Transfer session canceled",
    silent: true,
  });
}

export function useLeagueMembers(leagueId: string) {
  return useApiQuery<TMembership[]>(
    ["leagues", leagueId, "members"],
    () => LeagueService.getMembers(leagueId),
    { enabled: !!leagueId },
  );
}

export function useTransfers(leagueId: string) {
  return useApiQuery<TTransfer[]>(
    ["leagues", leagueId, "transfers"],
    () => LeagueService.getTransfers(leagueId),
    { enabled: !!leagueId },
  );
}

export function useUserTransfers() {
  return useApiQuery<TUserTransferLeagueGroup[]>(
    ["leagues", "me", "transfers"],
    () => LeagueService.getMyTransfersGrouped(),
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
    (targetSeasonId?: string) =>
      LeagueService.renewLeague(leagueId, targetSeasonId),
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

export function useGenerateTransferWindows(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(() => LeagueService.generateTransferWindows(leagueId), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
    },
    successMessage: "Transfer windows generated",
  });
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

export const useLineup = (leagueId: string) => {
  return useApiQuery(["leagues", leagueId, "lineup"], () =>
    LeagueService.getLineup(leagueId),
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
