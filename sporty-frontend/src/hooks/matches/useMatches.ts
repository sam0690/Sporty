import { keepPreviousData } from "@tanstack/react-query";

import { useApiQuery } from "../api/useApiQuery";
import { MatchService } from "@/services/MatchService";
import type { TMatchFilter, TMatchListResponse } from "@/types/match";

export const useMatches = (filters: TMatchFilter = {}) => {
  return useApiQuery<TMatchListResponse>(
    ["matches", "list", JSON.stringify(filters)],
    () => MatchService.getMatches(filters),
    {
      placeholderData: keepPreviousData,
    },
  );
};
