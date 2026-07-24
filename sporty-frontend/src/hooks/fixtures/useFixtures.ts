import { keepPreviousData } from "@tanstack/react-query";

import { useApiQuery } from "../api/useApiQuery";
import { FixturesService } from "@/services/FixturesService";
import type { TFixtureFilter, TFixtureListResponse } from "@/types/fixture";

export const useFixtures = (filters: TFixtureFilter = {}) => {
  return useApiQuery<TFixtureListResponse>(
    ["fixtures", "list", JSON.stringify(filters)],
    () => FixturesService.getFixtures(filters),
    {
      placeholderData: keepPreviousData,
      // Not push-driven: poll fast while any match is live (scores tick),
      // slower otherwise (so scheduled→live flips still catch within ~30s).
      refetchInterval: (query) => {
        const items = query.state.data?.items ?? [];
        const hasLive = items.some((f) => (f.status ?? "").toLowerCase() === "live");
        return hasLive ? 10_000 : 30_000;
      },
      refetchOnWindowFocus: true,
    },
  );
};

// Enabled only when the current day is empty — finds the next day with games.
export const useNextMatchday = (after: string, sport?: string, enabled = true) => {
  return useApiQuery<{ date: string | null }>(
    ["fixtures", "next", after, sport ?? "all"],
    () => FixturesService.nextMatchday(after, sport),
    { enabled, staleTime: 5 * 60_000 },
  );
};
