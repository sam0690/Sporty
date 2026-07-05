import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminLeagueListParams,
  type TAdminLeagueListResponse,
} from "@/services/AdminService";

const LEAGUES_KEY = (params?: TAdminLeagueListParams) => ["admin", "leagues", params ?? {}];

export function useAdminLeagues(params?: TAdminLeagueListParams) {
  return useApiQuery<TAdminLeagueListResponse>(LEAGUES_KEY(params), () =>
    AdminService.getLeagues(params),
  );
}

export function useOverrideLeagueStatus() {
  const queryClient = useQueryClient();
  return useApiMutation<unknown, { id: string; newStatus: string; reason?: string }>(
    ({ id, newStatus, reason }) => AdminService.overrideLeagueStatus(id, newStatus, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "leagues"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "League status updated",
    },
  );
}

export function useOverrideDeleteLeague() {
  const queryClient = useQueryClient();
  return useApiMutation<void, string>(
    (id: string) => AdminService.overrideDeleteLeague(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "leagues"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "League deleted",
    },
  );
}

export function useOverrideLeagueSettings() {
  const queryClient = useQueryClient();
  return useApiMutation<
    unknown,
    { id: string; data: { name?: string; is_public?: boolean; reason?: string } }
  >(
    ({ id, data }) => AdminService.overrideLeagueSettings(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "leagues"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "League settings updated",
    },
  );
}
