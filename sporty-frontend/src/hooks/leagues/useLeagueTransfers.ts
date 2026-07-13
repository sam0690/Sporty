/**
 * Budget-league transfers — staging, confirmation, history.
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
import {
  ACTIVE_WINDOW_QUERY_KEY,
  EDITABLE_WINDOW_QUERY_KEY,
  refreshActiveWindow,
  shouldRefreshActiveWindow,
} from "./windowRefresh";


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
