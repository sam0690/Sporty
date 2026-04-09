import { useQueries, useQueryClient } from "@tanstack/react-query";
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
} from "@/types";
import { toastifier } from "@/libs/toastifier";

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
    () => LeagueService.getMyTeam(id),
    {
      enabled: !!id,
    },
  );
}

export function useMyTeamsForLeagues(leagueIds: string[]) {
  return useQueries({
    queries: leagueIds.map((leagueId) => ({
      queryKey: ["leagues", leagueId, "my-team"],
      queryFn: () => LeagueService.getMyTeam(leagueId),
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

export function useGenerateTransferWindows(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(() => LeagueService.generateTransferWindows(leagueId), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
    },
    successMessage: "Transfer windows generated",
  });
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
        toastifier.success("Lineup saved successfully");
      },
    },
  );
}

export function useLeaderboard(leagueId: string, windowId?: string) {
  return useApiQuery<TLeaderboardResponse>(
    ["leagues", leagueId, "leaderboard", windowId],
    () => LeagueService.getLeaderboard(leagueId, windowId ?? undefined),
    { enabled: !!leagueId },
  );
}

export function useActiveWindow(leagueId: string) {
  return useApiQuery<TTransferWindow>(
    ["leagues", leagueId, "active-window"],
    () => LeagueService.getActiveWindow(leagueId),
    { enabled: !!leagueId },
  );
}
