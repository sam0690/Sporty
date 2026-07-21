import { useQueryClient } from "@tanstack/react-query";

import { useApiQuery } from "../api/useApiQuery";
import { useApiMutation } from "../api/useApiMutation";
import { PredictionService } from "@/services/PredictionService";
import type {
  TLeaderboardResponse,
  TPrediction,
  TPredictionCreate,
  TPredictionListResponse,
} from "@/types/prediction";

/** The current user's prediction for one fixture (null if not made yet).
 *  `enabled` is false for guests so we never fire an authed request that 401s. */
export const useMyPrediction = (matchId: string, enabled = true) =>
  useApiQuery<TPrediction | null>(
    ["predictions", "match", matchId],
    () => PredictionService.forMatch(matchId),
    { enabled },
  );

/** Submit/update a prediction; refreshes this fixture's prediction on success. */
export const useSubmitPrediction = (matchId: string) => {
  const qc = useQueryClient();
  return useApiMutation<TPrediction, TPredictionCreate>(
    (payload) => PredictionService.submit(payload),
    {
      successMessage: "Prediction saved",
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["predictions", "match", matchId] });
        qc.invalidateQueries({ queryKey: ["predictions", "mine"] });
      },
    },
  );
};

/** The current user's predictions (resolved filters scored vs pending). */
export const useMyPredictions = (resolved?: boolean) =>
  useApiQuery<TPredictionListResponse>(
    ["predictions", "mine", String(resolved)],
    () => PredictionService.mine(resolved),
  );

/** Predictor leaderboard — global or per-league. */
export const usePredictionLeaderboard = (leagueId?: string) =>
  useApiQuery<TLeaderboardResponse>(
    ["predictions", "leaderboard", leagueId ?? "global"],
    () => PredictionService.leaderboard(leagueId),
  );
