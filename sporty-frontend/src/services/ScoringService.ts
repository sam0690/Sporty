import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";

export type TScoringRule = {
  id: string;
  action: string;
  points: number;
  description: string;
  sport: {
    name: string;
    display_name: string;
  };
  created_at: string;
  updated_at: string;
};

export type TScoringOverride = {
  id: string;
  action: string;
  points: number;
  sport: {
    name: string;
    display_name: string;
  };
  created_at: string;
};

export const ScoringService = {
  async getDefaultRules(sportName: string): Promise<TScoringRule[]> {
    const res = await authApi.get(API_PATHS.SCORING.RULES(sportName));
    return res.data;
  },

  async getOverrides(leagueId: string): Promise<TScoringOverride[]> {
    const res = await authApi.get(API_PATHS.SCORING.OVERRIDES(leagueId));
    return res.data;
  },

  async upsertOverride(
    leagueId: string,
    payload: { sport_id: string; action: string; points: number },
  ): Promise<TScoringOverride> {
    const res = await authApi.post(
      API_PATHS.SCORING.OVERRIDES(leagueId),
      payload,
    );
    return res.data;
  },

  async deleteOverride(leagueId: string, overrideId: string): Promise<void> {
    await authApi.delete(
      API_PATHS.SCORING.OVERRIDE_DETAIL(leagueId, overrideId),
    );
  },
};
