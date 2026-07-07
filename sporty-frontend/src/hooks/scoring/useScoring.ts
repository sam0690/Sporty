import { useApiQuery } from "@/hooks/api/useApiQuery";
import { ScoringService, type TScoringRule } from "@/services/ScoringService";

export function useDefaultScoringRules(sportName: string) {
  return useApiQuery<TScoringRule[]>(
    ["scoring", "rules", sportName],
    () => ScoringService.getDefaultRules(sportName),
    { enabled: !!sportName },
  );
}
