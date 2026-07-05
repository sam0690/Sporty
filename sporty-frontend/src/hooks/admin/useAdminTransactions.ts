import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TTradeActionResponse,
  type TTransferReverseResponse,
  type TWaiverClaimCancelResponse,
} from "@/services/AdminService";

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
