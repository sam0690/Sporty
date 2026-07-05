import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import { AdminService, type TSystemConfigEntry } from "@/services/AdminService";

export function useSystemConfig() {
  return useApiQuery<TSystemConfigEntry[]>(["admin", "config"], () => AdminService.getSystemConfig());
}

export function useToggleRealtimePipeline() {
  const queryClient = useQueryClient();
  return useApiMutation<TSystemConfigEntry, { enabled: boolean; reason?: string }>(
    ({ enabled, reason }) => AdminService.toggleRealtimePipeline(enabled, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Realtime pipeline flag updated",
    },
  );
}

export function useToggleLivePolling() {
  const queryClient = useQueryClient();
  return useApiMutation<TSystemConfigEntry, { enabled: boolean; reason?: string }>(
    ({ enabled, reason }) => AdminService.toggleLivePolling(enabled, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Live-polling flag updated",
    },
  );
}
