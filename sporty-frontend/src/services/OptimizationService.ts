import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";

export type TOptimizationCandidate = {
  id: string;
  position: string;
  club: string;
  cost: number;
  projected_points: number;
  is_available: boolean;
};

export type TOptimizationRequest = {
  candidates: TOptimizationCandidate[];
  constraints: {
    budget: number;
    squad_size: number;
    positions: Record<string, { min?: number; max?: number; exact?: number }>;
    max_per_club: number;
    locked_player_ids: string[];
    banned_player_ids: string[];
    vice_bonus_multiplier?: number;
  };
};

export type TOptimizationResponse = {
  selected_player_ids: string[];
  captain_player_id: string;
  vice_captain_player_id: string;
  total_cost: number;
  projected_points_without_multiplier: number;
  projected_points_with_captain_bonus: number;
  solver_status: string;
};

export const OptimizationService = {
  async optimizeLineup(
    payload: TOptimizationRequest,
  ): Promise<TOptimizationResponse> {
    const res = await authApi.post(API_PATHS.OPTIMIZATION.LINEUP, payload);
    return res.data;
  },
};
