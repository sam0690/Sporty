import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import { isApiError } from "@/utils/api-Error";
import type { TFantasyTeam } from "@/types/league";

export const myTeamService = {
  async getMyTeam(
    leagueId: string,
    signal?: AbortSignal,
  ): Promise<TFantasyTeam | null> {
    try {
      const res = await authApi.get(API_PATHS.LEAGUES.MY_TEAM(leagueId), {
        signal,
      });
      return res.data;
    } catch (error) {
      if (isApiError(error) && error.statusCode === 404) {
        return null;
      }

      throw error;
    }
  },
};
