import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TLeagueActivityEvent } from "@/types";

export const LeagueActivityService = {
  /** Chronological league activity feed, newest first. `before` (an event's
   * created_at) pages further back in time. */
  async list(
    leagueId: string,
    params?: { limit?: number; before?: string },
  ): Promise<TLeagueActivityEvent[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.ACTIVITY(leagueId), {
      params,
    });
    return res.data;
  },
};
