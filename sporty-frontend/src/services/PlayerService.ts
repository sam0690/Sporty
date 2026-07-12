import { authApi } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type {
  TPlayer,
  TPlayerListResponse,
  TPlayerFilter,
  TPlayerGameweekStat,
  TPlayerRecentStatsResponse,
} from "@/types";

type BackendPlayer = {
  id: string;
  name: string;
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  cost: number;
  is_available: boolean;
  created_at: string;
  projected_points?: number | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: number | null;
  bio?: string | null;
  wage?: string | null;
  signing_fee?: string | null;
  date_signed?: string | null;
  agent?: string | null;
  social_links?: Record<string, string> | null;
  sport: {
    name: string;
    display_name: string;
  };
};

export type TTeamBrief = {
  id: string;
  name: string;
  logo_url: string | null;
  sport: {
    name: string;
    display_name: string;
  };
};

type TPlayerStatsResponse = {
  player: {
    id: string;
    name: string;
    position: string;
    real_team: string;
    cost: number;
    sport: {
      name: string;
      display_name: string;
    };
  };
  transfer_window: {
    id: string;
    number: number;
    start_at: string;
    end_at: string;
  };
  minutes_played: number;
  fantasy_points: number;
  football_stat?: Record<string, number> | null;
  cricket_stat?: Record<string, number | string | null> | null;
};

const mapBackendPlayer = (player: BackendPlayer): TPlayer => ({
  id: player.id,
  name: player.name,
  display_name: player.name,
  position: player.position,
  real_team: player.real_team,
  photo_url: player.photo_url ?? null,
  real_team_logo_url: player.real_team_logo_url ?? null,
  cost: Number(player.cost),
  current_cost: Number(player.cost),
  projected_points:
    player.projected_points != null ? Number(player.projected_points) : null,
  is_available: player.is_available,
  is_active: player.is_available,
  created_at: player.created_at,
  nationality: player.nationality ?? null,
  date_of_birth: player.date_of_birth ?? null,
  height: player.height ?? null,
  weight: player.weight ?? null,
  jersey_number: player.jersey_number ?? null,
  bio: player.bio ?? null,
  wage: player.wage ?? null,
  signing_fee: player.signing_fee ?? null,
  date_signed: player.date_signed ?? null,
  agent: player.agent ?? null,
  social_links: player.social_links ?? null,
  sport: {
    name: player.sport.name,
    display_name: player.sport.display_name,
  },
});

/**
 * Player service — handles all player-related API calls.
 */
export const PlayerService = {
  /** List players with optional filters */
  async getPlayers(filters: TPlayerFilter = {}): Promise<TPlayerListResponse> {
    const params: TPlayerFilter = {
      league_id: filters.league_id,
      sport_name: filters.sport_name,
      position: filters.position,
      real_team: filters.real_team,
      page: filters.page,
      page_size: filters.page_size,
      name: filters.name ?? filters.search,
      minCost: filters.minCost ?? filters.min_cost,
      maxCost: filters.maxCost ?? filters.max_cost,
    };

    const res = await authApi.get(API_PATHS.PLAYERS.LIST, { params });
    return {
      ...res.data,
      items: (res.data.items as BackendPlayer[]).map(mapBackendPlayer),
    };
  },

  /** Get details for a specific player */
  async getPlayer(id: string): Promise<TPlayer> {
    const res = await authApi.get(API_PATHS.PLAYERS.DETAIL(id));
    return mapBackendPlayer(res.data as BackendPlayer);
  },

  /** Same as getPlayer, no login required — for the shareable /p/[id] profile. */
  async getPublicPlayer(id: string): Promise<TPlayer> {
    const res = await publicApi.get(API_PATHS.PLAYERS.PUBLIC_DETAIL(id));
    return mapBackendPlayer(res.data as BackendPlayer);
  },

  /** Get player stats for a specific gameweek/transfer window */
  async getPlayerStats(
    id: string,
    windowId: string,
  ): Promise<TPlayerStatsResponse> {
    const res = await authApi.get(API_PATHS.PLAYERS.STAT_DETAIL(id, windowId));
    return res.data;
  },

  /** Get all player stats for a gameweek and sport in one request */
  async getPlayerStatsBulk(
    gameweekId: string,
    sport: string,
  ): Promise<TPlayerStatsResponse[]> {
    const res = await authApi.get(API_PATHS.PLAYERS.STATS, {
      params: {
        gameweek_id: gameweekId,
        sport,
      },
    });
    return res.data as TPlayerStatsResponse[];
  },

  /** Get a player's recent gameweek-by-gameweek performance, newest first */
  async getPlayerRecentStats(
    id: string,
    limit = 5,
  ): Promise<TPlayerGameweekStat[]> {
    const res = await authApi.get(API_PATHS.PLAYERS.RECENT_STATS(id), {
      params: { limit },
    });
    const data = res.data as TPlayerRecentStatsResponse;
    return data.items.map((item) => ({
      ...item,
      fantasy_points: Number(item.fantasy_points),
    }));
  },

  /** Same as getPlayerRecentStats, no login required. */
  async getPublicPlayerRecentStats(
    id: string,
    limit = 5,
  ): Promise<TPlayerGameweekStat[]> {
    const res = await publicApi.get(API_PATHS.PLAYERS.PUBLIC_RECENT_STATS(id), {
      params: { limit },
    });
    const data = res.data as TPlayerRecentStatsResponse;
    return data.items.map((item) => ({
      ...item,
      fantasy_points: Number(item.fantasy_points),
    }));
  },

  /** List real teams (with crest), optionally filtered by sport */
  async getTeams(sportName?: string): Promise<TTeamBrief[]> {
    const res = await authApi.get(API_PATHS.PLAYERS.TEAMS, {
      params: sportName ? { sport_name: sportName } : undefined,
    });
    return res.data as TTeamBrief[];
  },
};
