import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TPlayer, TPlayerListResponse, TPlayerFilter } from "@/types";

/**
 * Player service — handles all player-related API calls.
 */
export const PlayerService = {
    /** List players with optional filters */
    async getPlayers(filters: TPlayerFilter = {}): Promise<TPlayerListResponse> {
        const res = await authApi.get(API_PATHS.PLAYERS.LIST, { params: filters });
        return res.data;
    },

    /** Get details for a specific player */
    async getPlayer(id: string): Promise<TPlayer> {
        const res = await authApi.get(API_PATHS.PLAYERS.DETAIL(id));
        return res.data;
    },

    /** Get player stats for a specific gameweek/transfer window */
    async getPlayerStats(id: string, windowId: string): Promise<any> {
        const res = await authApi.get(API_PATHS.PLAYERS.STATS(id, windowId));
        return res.data;
    },
};
