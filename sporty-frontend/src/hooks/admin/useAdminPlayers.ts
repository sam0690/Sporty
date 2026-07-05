import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminPlayerDetail,
  type TAdminPlayerEditRequest,
  type TRepriceResponse,
} from "@/services/AdminService";

export function useAdminPlayer(id: string) {
  return useApiQuery<TAdminPlayerDetail>(
    ["admin", "players", id],
    () => AdminService.getPlayer(id),
    { enabled: !!id },
  );
}

export function useEditPlayer() {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminPlayerDetail, { id: string; data: TAdminPlayerEditRequest }>(
    ({ id, data }) => AdminService.editPlayer(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: ["admin", "players", id] });
        queryClient.invalidateQueries({ queryKey: ["players"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Player updated",
    },
  );
}

export function useTriggerRepricing() {
  const queryClient = useQueryClient();
  return useApiMutation<TRepriceResponse, { lookbackWindows: number; reason?: string }>(
    ({ lookbackWindows, reason }) => AdminService.triggerRepricing(lookbackWindows, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["players"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Repricing triggered",
    },
  );
}
