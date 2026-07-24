import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type {
  TCompetitionMatchesResponse,
  TCompetitionsIndex,
  TScorersResponse,
  TStandingsResponse,
} from "@/types/competition";

// Public, read-only discovery surface — competition pages work for guests and
// members alike, so everything goes through the public client.
export const CompetitionService = {
  async list(): Promise<TCompetitionsIndex> {
    const res = await publicApi.get(API_PATHS.COMPETITIONS.LIST);
    return res.data as TCompetitionsIndex;
  },

  async standings(tag: string, season?: number): Promise<TStandingsResponse> {
    const res = await publicApi.get(API_PATHS.COMPETITIONS.STANDINGS(tag), {
      params: season ? { season } : {},
    });
    return res.data as TStandingsResponse;
  },

  async scorers(tag: string, season?: number): Promise<TScorersResponse> {
    const res = await publicApi.get(API_PATHS.COMPETITIONS.SCORERS(tag), {
      params: season ? { season } : {},
    });
    return res.data as TScorersResponse;
  },

  async matches(tag: string, season?: number): Promise<TCompetitionMatchesResponse> {
    const res = await publicApi.get(API_PATHS.COMPETITIONS.MATCHES(tag), {
      params: season ? { season } : {},
    });
    return res.data as TCompetitionMatchesResponse;
  },
};
