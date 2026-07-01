import { authApi } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TMatchFilter, TMatchListResponse } from "@/types/match";

export const MatchService = {
  /** List fixtures the user can view (any authenticated user, all sports). */
  async getMatches(filters: TMatchFilter = {}): Promise<TMatchListResponse> {
    const params: TMatchFilter = {
      status: filters.status,
      sport_name: filters.sport_name,
      limit: filters.limit,
    };
    const res = await authApi.get(API_PATHS.MATCHES.LIST, { params });
    return res.data as TMatchListResponse;
  },

  /** Public live + upcoming fixtures for the landing page (no auth). */
  async getPublicMatches(
    filters: Pick<TMatchFilter, "sport_name" | "limit"> = {},
  ): Promise<TMatchListResponse> {
    const res = await publicApi.get(API_PATHS.MATCHES.PUBLIC, {
      params: { sport_name: filters.sport_name, limit: filters.limit },
    });
    return res.data as TMatchListResponse;
  },
};
