/**
 * Draft-league roster movement — free agents, waivers, trades, matchups/H2H.
 *
 * Split from the former 848-line useLeagues.ts; that file re-exports
 * everything, so existing imports keep working.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "../api/useApiQuery";
import { useApiMutation } from "../api/useApiMutation";
import { LeagueService } from "@/services/LeagueService";
import {
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
} from "@/types";


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
        // A claim can resolve a pending waiver and always changes the roster
        // other members see when building a trade.
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "waivers"],
        });
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "trade-rosters"],
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
        // Reordering is precisely what changes this — and it is a separate
        // key, not a child of ["leagues", id, "waivers"].
        queryClient.invalidateQueries({
          queryKey: ["leagues", leagueId, "waiver-order"],
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
      // An accepted trade moves players between two rosters, which changes
      // both squads' projected strength and any H2H matchup built from them.
      queryClient.invalidateQueries({
        queryKey: ["leagues", leagueId, "trade-rosters"],
      });
      queryClient.invalidateQueries({
        queryKey: ["leagues", leagueId, "power-rankings"],
      });
      queryClient.invalidateQueries({
        queryKey: ["leagues", leagueId, "matchups"],
      });
    },
    successMessage: "Trade updated",
  });
};

export const useMatchups = (leagueId: string, windowId?: string, enabled = true) => {
  return useApiQuery<TMatchup[]>(
    ["leagues", leagueId, "matchups", windowId ?? "current"],
    () => LeagueService.getMatchups(leagueId, windowId),
    { enabled: !!leagueId && enabled },
  );
};

export const useFullSchedule = (leagueId: string, enabled = true) => {
  return useApiQuery<TMatchup[]>(
    ["leagues", leagueId, "matchups", "full-schedule"],
    () => LeagueService.getFullSchedule(leagueId),
    { enabled: !!leagueId && enabled },
  );
};

export const useH2HStandings = (leagueId: string, enabled = true) => {
  return useApiQuery<TH2HStandingRow[]>(
    ["leagues", leagueId, "matchups", "standings"],
    () => LeagueService.getH2HStandings(leagueId),
    { enabled: !!leagueId && enabled },
  );
};
