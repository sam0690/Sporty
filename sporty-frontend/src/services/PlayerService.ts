import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TPlayer, TPlayerListResponse, TPlayerFilter } from "@/types";

type BackendPlayer = {
  id: string;
  name: string;
  position: string;
  real_team: string;
  cost: number;
  is_available: boolean;
  created_at: string;
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
  cost: Number(player.cost),
  current_cost: Number(player.cost),
  is_available: player.is_available,
  is_active: player.is_available,
  created_at: player.created_at,
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
    const res = await authApi.get(API_PATHS.PLAYERS.LIST, { params: filters });
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

  /** Get player stats for a specific gameweek/transfer window */
  async getPlayerStats(
    id: string,
    windowId: string,
  ): Promise<TPlayerStatsResponse> {
    const res = await authApi.get(API_PATHS.PLAYERS.STATS(id, windowId));
    return res.data;
  },
};
