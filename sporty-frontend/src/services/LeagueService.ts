import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { TLeague, TMembership, TLineupSlot, TLeaderboardEntry, TLeaderboardResponse, TSeason, TSport, TFantasyTeam, TLineupResponse, TLineupUpdateRequest, TTransferWindow } from "@/types/league";

/**
 * League service — handles all league-related API calls.
 */
export const LeagueService = {
    /** List all active seasons */
    async getSeasons(): Promise<TSeason[]> {
        const res = await authApi.get(API_PATHS.LEAGUES.SEASONS);
        return res.data;
    },

    /** List all active sports */
    async getSports(): Promise<TSport[]> {
        const res = await authApi.get(API_PATHS.LEAGUES.SPORTS);
        return res.data;
    },
    /** List leagues the current user is a member of */
    async getMyLeagues(): Promise<TLeague[]> {
        const res = await authApi.get(API_PATHS.LEAGUES.LIST);
        return res.data;
    },

    /** Discover public leagues */
    async discoverLeagues(): Promise<TLeague[]> {
        const res = await authApi.get(API_PATHS.LEAGUES.DISCOVER);
        return res.data;
    },

    /** Get details for a specific league */
    async getLeague(id: string): Promise<TLeague> {
        const res = await authApi.get(API_PATHS.LEAGUES.DETAIL(id));
        return res.data;
    },

    /** Get the current user's fantasy team in a league */
    async getMyTeam(id: string): Promise<TFantasyTeam> {
        const res = await authApi.get(API_PATHS.LEAGUES.MY_TEAM(id));
        return res.data;
    },

    /** Create a new league */
    async createLeague(payload: {
        name: string;
        season_id: string;
        is_public?: boolean;
        max_teams?: number;
        squad_size?: number;
        budget_per_team?: number;
        draft_mode?: boolean;
        transfers_per_window?: number;
        transfer_day?: number;
    }): Promise<TLeague> {
        const res = await authApi.post(API_PATHS.LEAGUES.CREATE, payload);
        return res.data;
    },

    /** Join a league using an invite code */
    async joinLeague(inviteCode: string): Promise<TMembership> {
        const res = await authApi.post(API_PATHS.LEAGUES.JOIN, { invite_code: inviteCode });
        return res.data;
    },

    /** Start the draft for a league */
    async startDraft(id: string): Promise<TLeague> {
        const res = await authApi.post(API_PATHS.LEAGUES.DRAFT_START(id));
        return res.data;
    },

    /** Make a draft pick */
    async makeDraftPick(id: string, playerId: string): Promise<any> {
        const res = await authApi.post(API_PATHS.LEAGUES.DRAFT_PICK(id), { player_id: playerId });
        return res.data;
    },


    /** List league members */
    async getMembers(id: string): Promise<TMembership[]> {
        const res = await authApi.get(API_PATHS.LEAGUES.MEMBERS(id));
        return res.data;
    },

    /** Add a sport to a league */
    async addSport(id: string, sportName: string): Promise<any> {
        const res = await authApi.post(API_PATHS.LEAGUES.LEAGUE_SPORTS(id), { sport_name: sportName });
        return res.data;
    },

    /** Add a lineup slot config to a league */
    async addLineupSlot(id: string, payload: {
        sport_name: string;
        position: string;
        min_count: number;
        max_count: number;
    }): Promise<TLineupSlot> {
        const res = await authApi.post(API_PATHS.LEAGUES.LINEUP_SLOTS(id), payload);
        return res.data;
    },

    /** Build initial team for a budget-mode league */
    async buildTeam(id: string, payload: {
        team_name: string;
        player_ids: string[];
    }): Promise<{ message: string; team_id: string }> {
        const res = await authApi.post(API_PATHS.LEAGUES.BUILD_TEAM(id), payload);
        return res.data;
    },

    /** Make a transfer (swap player in vs player out) */
    async makeTransfer(id: string, payload: {
        player_in_id: string;
        player_out_id: string;
    }): Promise<any> {
        const res = await authApi.post(API_PATHS.LEAGUES.TRANSFERS(id), payload);
        return res.data;
    },

    /** Get the user's current lineup for a league */
    async getLineup(id: string): Promise<TLineupResponse> {
        const res = await authApi.get(API_PATHS.LEAGUES.LINEUP(id));
        return res.data;
    },

    /** Update the user's lineup for a league */
    async updateLineup(leagueId: string, data: TLineupUpdateRequest): Promise<TLineupResponse> {
        return (await authApi.post<TLineupResponse>(API_PATHS.LEAGUES.LINEUP(leagueId), data)).data;
    },

    async getLeaderboard(leagueId: string, windowId?: string): Promise<TLeaderboardResponse> {
        return (await authApi.get<TLeaderboardResponse>(API_PATHS.LEAGUES.LEADERBOARD(leagueId, windowId))).data;
    },

    async getActiveWindow(leagueId: string): Promise<TTransferWindow> {
        return (await authApi.get<TTransferWindow>(API_PATHS.LEAGUES.ACTIVE_WINDOW(leagueId))).data;
    },
};
