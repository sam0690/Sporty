import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminTradeItem,
  type TAdminTransferItem,
  type TAdminWaiverClaimItem,
  type TTradeActionResponse,
  type TTransferReverseResponse,
  type TWaiverClaimCancelResponse,
} from "@/services/AdminService";

export function useLeagueTrades(leagueId: string, onlyActionable = true) {
  return useApiQuery<TAdminTradeItem[]>(
    ["admin", "leagues", leagueId, "trades", onlyActionable],
    () => AdminService.getLeagueTrades(leagueId, onlyActionable),
    { enabled: !!leagueId },
  );
}

export function useLeagueWaiverClaims(leagueId: string, onlyPending = true) {
  return useApiQuery<TAdminWaiverClaimItem[]>(
    ["admin", "leagues", leagueId, "waivers", onlyPending],
    () => AdminService.getLeagueWaiverClaims(leagueId, onlyPending),
    { enabled: !!leagueId },
  );
}

export function useLeagueTransfers(leagueId: string, onlyReversible = false) {
  return useApiQuery<TAdminTransferItem[]>(
    ["admin", "leagues", leagueId, "transfers", onlyReversible],
    () => AdminService.getLeagueTransfers(leagueId, onlyReversible),
    { enabled: !!leagueId },
  );
}

export function useVetoTrade() {
  const queryClient = useQueryClient();
  return useApiMutation<TTradeActionResponse, { leagueId: string; tradeId: string; reason?: string }>(
    ({ leagueId, tradeId, reason }) => AdminService.vetoTrade(leagueId, tradeId, reason),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] }),
      successMessage: "Trade vetoed",
    },
  );
}

export function useCancelTrade() {
  const queryClient = useQueryClient();
  return useApiMutation<TTradeActionResponse, { leagueId: string; tradeId: string; reason?: string }>(
    ({ leagueId, tradeId, reason }) => AdminService.cancelTrade(leagueId, tradeId, reason),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] }),
      successMessage: "Trade cancelled",
    },
  );
}

export function useCancelWaiverClaim() {
  const queryClient = useQueryClient();
  return useApiMutation<TWaiverClaimCancelResponse, { leagueId: string; claimId: string; reason?: string }>(
    ({ leagueId, claimId, reason }) => AdminService.cancelWaiverClaim(leagueId, claimId, reason),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] }),
      successMessage: "Waiver claim cancelled",
    },
  );
}

export function useReverseTransfer() {
  const queryClient = useQueryClient();
  return useApiMutation<TTransferReverseResponse, { transferId: string; reason?: string }>(
    ({ transferId, reason }) => AdminService.reverseTransfer(transferId, reason),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] }),
      successMessage: "Transfer reversed",
    },
  );
}
