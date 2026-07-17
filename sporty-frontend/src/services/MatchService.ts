import { authApi } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TMatchFilter, TMatchListResponse } from "@/types/match";

export const MatchService = {
  /** List fixtures — a public discovery surface (no auth), so it goes through
   *  the public client and works identically for guests and members. */
  async getMatches(filters: TMatchFilter = {}): Promise<TMatchListResponse> {
    const params: TMatchFilter = {
      status: filters.status,
      sport_name: filters.sport_name,
      date: filters.date,
      limit: filters.limit,
    };
    const res = await publicApi.get(API_PATHS.MATCHES.LIST, { params });
    return res.data as TMatchListResponse;
  },

  /** Live matches involving the current user's favourite teams (authed) —
   *  each item includes the current match minute. Feeds the dashboard
   *  live ticker. */
  async getLiveForFavourites(): Promise<TMatchListResponse> {
    const res = await authApi.get(API_PATHS.MATCHES.LIVE_FAVOURITES);
    return res.data as TMatchListResponse;
  },
};
