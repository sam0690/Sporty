import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import {
  ScoringService,
  type TScoringOverride,
  type TScoringRule,
} from "@/services/ScoringService";

export function useDefaultScoringRules(sportName: string) {
  return useApiQuery<TScoringRule[]>(
    ["scoring", "rules", sportName],
    () => ScoringService.getDefaultRules(sportName),
    { enabled: !!sportName },
  );
}

export function useScoringOverrides(leagueId: string) {
  return useApiQuery<TScoringOverride[]>(
    ["scoring", "overrides", leagueId],
    () => ScoringService.getOverrides(leagueId),
    { enabled: !!leagueId },
  );
}

export function useUpsertScoringOverride(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (payload: { sport_id: string; action: string; points: number }) =>
      ScoringService.upsertOverride(leagueId, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["scoring", "overrides", leagueId],
        });
      },
      successMessage: "Scoring rule updated",
    },
  );
}

export function useDeleteScoringOverride(leagueId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (overrideId: string) => ScoringService.deleteOverride(leagueId, overrideId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["scoring", "overrides", leagueId],
        });
      },
      successMessage: "Scoring override removed",
    },
  );
}
