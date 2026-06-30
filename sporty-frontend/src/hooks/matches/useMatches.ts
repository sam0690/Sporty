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
      // The list isn't push-driven, so poll: fast while any match is live (so
      // scores tick), slower otherwise (so scheduled→live flips are still
      // caught within ~30s). Also refetch when the tab regains focus.
      refetchInterval: (query) => {
        const items = query.state.data?.items ?? [];
        const hasLive = items.some(
          (m) => (m.status ?? "").toLowerCase() === "live",
        );
        return hasLive ? 10_000 : 30_000;
      },
      refetchOnWindowFocus: true,
    },
  );
};
