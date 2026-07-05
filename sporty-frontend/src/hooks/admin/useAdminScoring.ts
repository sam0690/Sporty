import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminTransferWindowItem,
  type TScoringRecalculateResponse,
  type TWindowLockResponse,
} from "@/services/AdminService";

export function useLeagueTransferWindows(leagueId: string) {
  return useApiQuery<TAdminTransferWindowItem[]>(
    ["admin", "leagues", leagueId, "transfer-windows"],
    () => AdminService.getLeagueTransferWindows(leagueId),
    { enabled: !!leagueId },
  );
}

export function useRecalculateWindowScore() {
  const queryClient = useQueryClient();
  return useApiMutation<TScoringRecalculateResponse, { leagueId: string; windowId: string; reason?: string }>(
    ({ leagueId, windowId, reason }) => AdminService.recalculateWindowScore(leagueId, windowId, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Scoring recalculated",
    },
  );
}

export function useRecalculateActiveWindows() {
  const queryClient = useQueryClient();
  return useApiMutation<TScoringRecalculateResponse, { reason?: string } | void>(
    (variables) => AdminService.recalculateActiveWindows(variables?.reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Active windows recalculated",
    },
  );
}

export function useSetWindowLock() {
  const queryClient = useQueryClient();
  return useApiMutation<
    TWindowLockResponse,
    { windowId: string; transfers_locked?: boolean; lineup_locked?: boolean; reason?: string }
  >(
    ({ windowId, ...data }) => AdminService.setWindowLock(windowId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Window lock updated",
    },
  );
}
