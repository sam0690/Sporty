import { keepPreviousData } from "@tanstack/react-query";

import { useApiQuery } from "../api/useApiQuery";
import { FixturesService } from "@/services/FixturesService";
import type { TFixtureFilter, TFixtureListResponse } from "@/types/fixture";

/**
 * Single source of truth for the fixtures-list key.
 *
 * Three places need to produce it identically — this hook, FixturesView's
 * adjacent-day prefetch, and the server prefetch in the /fixtures page. It was
 * hand-inlined at each, so changing the key here would have silently turned
 * both prefetches into cache misses.
 */
export const fixturesKey = (filters: TFixtureFilter = {}) =>
  ["fixtures", "list", JSON.stringify(filters)] as const;

export const useFixtures = (filters: TFixtureFilter = {}) => {
  return useApiQuery<TFixtureListResponse>(
    fixturesKey(filters),
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
