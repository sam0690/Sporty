import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminSeason,
  type TSeasonCreateRequest,
  type TSeasonGenerateWindowsRequest,
  type TSeasonUpdateRequest,
} from "@/services/AdminService";

const SEASONS_KEY = ["admin", "seasons"];

export function useAdminSeasons() {
  return useApiQuery<TAdminSeason[]>(SEASONS_KEY, () => AdminService.getSeasons());
}

export function useCreateSeason() {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminSeason, TSeasonCreateRequest>(
    (data) => AdminService.createSeason(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Season created",
    },
  );
}

export function useUpdateSeason() {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminSeason, { id: string; data: TSeasonUpdateRequest }>(
    ({ id, data }) => AdminService.updateSeason(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Season updated",
    },
  );
}

export function useGenerateSeasonWindows() {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminSeason, { id: string; data: TSeasonGenerateWindowsRequest }>(
    ({ id, data }) => AdminService.generateSeasonWindows(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Transfer windows generated",
    },
  );
}
