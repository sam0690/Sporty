import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "../api/useApiQuery";
import { useApiMutation } from "../api/useApiMutation";
import { LeagueService } from "@/services/LeagueService";
import {
    TLeague,
    TMembership,
    TSeason,
    TSport,
    TFantasyTeam,
    TLineupUpdateRequest,
    TLineupResponse,
    TLeaderboardResponse,
    TTransferWindow
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
    return useApiQuery<TLeague[]>(["leagues", "me"], () => LeagueService.getMyLeagues());
};

export const useDiscoverLeagues = () => {
    return useApiQuery<TLeague[]>(["leagues", "discover"], () => LeagueService.discoverLeagues());
};

export const useLeague = (id: string) => {
    return useApiQuery<TLeague>(["leagues", id], () => LeagueService.getLeague(id), {
        enabled: !!id,
    });
};

/**
 * Hook to fetch the current user's fantasy team in a league.
 */
export function useMyTeam(id: string) {
    return useApiQuery<TFantasyTeam>(["leagues", id, "my-team"], () => LeagueService.getMyTeam(id), {
        enabled: !!id,
    });
}

export function useCreateLeague() {
    const queryClient = useQueryClient();
    return useApiMutation(
        (payload: any) => LeagueService.createLeague(payload),
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["leagues"] });
            },
            successMessage: "League created successfully!",
        }
    );
}

/**
 * Hook to build initial team in a budget-mode league.
 */
export function useBuildTeam() {
    const queryClient = useQueryClient();
    return useApiMutation(
        ({ id, payload }: { id: string; payload: any }) =>
            LeagueService.buildTeam(id, payload),
        {
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({ queryKey: ["leagues", variables.id] });
                queryClient.invalidateQueries({ queryKey: ["leagues", "me"] });
            },
            successMessage: "Team built successfully!",
        }
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
        }
    );
};

export const useStartDraft = () => {
    const queryClient = useQueryClient();
    return useApiMutation(
        (id: string) => LeagueService.startDraft(id),
        {
            onSuccess: (_, id) => {
                queryClient.invalidateQueries({ queryKey: ["leagues", id] });
            },
            successMessage: "Draft started!",
        }
    );
};

/**
 * Hook to make a player transfer.
 */
export const useMakeTransfer = (leagueId: string) => {
    const queryClient = useQueryClient();
    return useApiMutation((payload: { player_in_id: string; player_out_id: string }) =>
        LeagueService.makeTransfer(leagueId, payload),
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
                queryClient.invalidateQueries({ queryKey: ["players"] });
            },
            successMessage: "Transfer completed successfully!",
        }
    );
};

export const useLineup = (leagueId: string) => {
    return useApiQuery(["leagues", leagueId, "lineup"], () =>
        LeagueService.getLineup(leagueId)
    );
};

export function useUpdateLineup(leagueId: string) {
    const queryClient = useQueryClient();
    return useApiMutation<TLineupResponse, TLineupUpdateRequest>(
        (data) => LeagueService.updateLineup(leagueId, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["leagues", leagueId, "lineup"] });
                toastifier.success("Lineup saved successfully");
            },
        }
    );
}

export function useLeaderboard(leagueId: string, windowId?: string) {
    return useApiQuery<TLeaderboardResponse>(
        ["leagues", leagueId, "leaderboard", windowId],
        () => LeagueService.getLeaderboard(leagueId, windowId ?? undefined),
        { enabled: !!leagueId }
    );
}

export function useActiveWindow(leagueId: string) {
    return useApiQuery<TTransferWindow>(
        ["leagues", leagueId, "active-window"],
        () => LeagueService.getActiveWindow(leagueId),
        { enabled: !!leagueId }
    );
}
