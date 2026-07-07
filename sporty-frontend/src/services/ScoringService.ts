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

export const ScoringService = {
  async getDefaultRules(sportName: string): Promise<TScoringRule[]> {
    const res = await authApi.get(API_PATHS.SCORING.RULES(sportName));
    return res.data;
  },
};
