import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TFixtureFilter, TFixtureListResponse } from "@/types/fixture";

// Public discovery surface (no auth) — the unified fixtures list for a day,
// merging fantasy matches with display-only competition matches (CL).
export const FixturesService = {
  async getFixtures(filters: TFixtureFilter = {}): Promise<TFixtureListResponse> {
    const params: TFixtureFilter = {
      date: filters.date,
      sport_name: filters.sport_name,
    };
    const res = await publicApi.get(API_PATHS.FIXTURES.LIST, { params });
    return res.data as TFixtureListResponse;
  },

  /** The next calendar day (after `after`) that has any fixture, for the
   *  empty-day "jump to next matchday" affordance. */
  async nextMatchday(after: string, sport_name?: string): Promise<{ date: string | null }> {
    const res = await publicApi.get(API_PATHS.FIXTURES.NEXT, {
      params: { after, sport_name },
    });
    return res.data as { date: string | null };
  },
};
