import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type {
  TLeaderboardResponse,
  TPrediction,
  TPredictionCreate,
  TPredictionListResponse,
} from "@/types/prediction";

export const PredictionService = {
  /** Submit or update the current user's exact-score prediction for a fixture. */
  async submit(payload: TPredictionCreate): Promise<TPrediction> {
    const res = await authApi.post(API_PATHS.PREDICTIONS.CREATE, payload);
    return res.data as TPrediction;
  },

  /** The current user's predictions; resolved filters scored vs pending. */
  async mine(resolved?: boolean): Promise<TPredictionListResponse> {
    const res = await authApi.get(API_PATHS.PREDICTIONS.ME(resolved));
    return res.data as TPredictionListResponse;
  },

  /** The current user's prediction for one fixture, or null if none yet. */
  async forMatch(matchId: string): Promise<TPrediction | null> {
    const res = await authApi.get(API_PATHS.PREDICTIONS.FOR_MATCH(matchId));
    return (res.data as TPrediction | null) ?? null;
  },

  /** Predictor leaderboard — global, or scoped to a league's members. */
  async leaderboard(leagueId?: string): Promise<TLeaderboardResponse> {
    const res = await authApi.get(API_PATHS.PREDICTIONS.LEADERBOARD(leagueId));
    return res.data as TLeaderboardResponse;
  },
};
