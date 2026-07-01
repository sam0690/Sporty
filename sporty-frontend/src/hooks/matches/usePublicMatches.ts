import { keepPreviousData } from "@tanstack/react-query";

import { useApiQuery } from "../api/useApiQuery";
import { MatchService } from "@/services/MatchService";
import type { TMatchListResponse } from "@/types/match";

type PublicMatchFilters = { sport_name?: string; limit?: number };

/** Unauthenticated live + upcoming fixtures for the landing page. */
export const usePublicMatches = (filters: PublicMatchFilters = {}) => {
  return useApiQuery<TMatchListResponse>(
    ["matches", "public", JSON.stringify(filters)],
    () => MatchService.getPublicMatches(filters),
    {
      placeholderData: keepPreviousData,
      // Poll fast while anything is live so landing scores tick; otherwise slow.
      refetchInterval: (query) => {
        const items = query.state.data?.items ?? [];
        const hasLive = items.some(
          (m) => (m.status ?? "").toLowerCase() === "live",
        );
        return hasLive ? 15_000 : 60_000;
      },
      refetchOnWindowFocus: true,
      // Landing is public and marketing — a failed fetch shouldn't spam retries.
      retry: 1,
    },
  );
};
