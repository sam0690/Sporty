import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";
import type {
  TCompetitionType,
  TLeague,
  TMembership,
  TDraftPick,
  TDraftTurn,
  TDiscardPlayerResponse,
  TLeagueSport,
  TLineupSlot,
  TLeaderboardResponse,
  TSeason,
  TSport,
  TFantasyTeam,
  TLineupResponse,
  TLineupUpdateRequest,
  TTransfer,
  TUserTransferLeagueGroup,
  TTransferWindow,
  TLeagueDashboardStats,
  TStageOutRequest,
  TStageOutResponse,
  TStageInRequest,
  TStageInResponse,
  TConfirmTransfersRequest,
  TConfirmTransfersResponse,
} from "@/types/league";

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
    sports?: string[];
    competitionType?: TCompetitionType;
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
    const res = await authApi.post(API_PATHS.LEAGUES.JOIN, {
      invite_code: inviteCode,
    });
    return res.data;
  },

  /** Leave a league as a non-owner member */
  async leaveLeague(id: string): Promise<{ message: string }> {
    const res = await authApi.post(API_PATHS.LEAGUES.LEAVE(id));
    return res.data;
  },

  /** Delete a league (owner only) */
  async deleteLeague(id: string): Promise<void> {
    await authApi.delete(API_PATHS.LEAGUES.DELETE(id));
  },

  /** Start the draft for a league */
  async startDraft(id: string): Promise<TLeague> {
    const res = await authApi.post(API_PATHS.LEAGUES.DRAFT_START(id));
    return res.data;
  },

  /** Make a draft pick */
  async makeDraftPick(id: string, playerId: string): Promise<TDraftPick> {
    const res = await authApi.post(API_PATHS.LEAGUES.DRAFT_PICK(id), {
      player_id: playerId,
    });
    return res.data;
  },

  /** Get current draft turn for polling clients */
  async getDraftTurn(id: string): Promise<TDraftTurn> {
    const res = await authApi.get(API_PATHS.LEAGUES.DRAFT_TURN(id));
    return res.data;
  },

  /** List league members */
  async getMembers(id: string): Promise<TMembership[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.MEMBERS(id));
    return res.data;
  },

  /** Add a sport to a league */
  async addSport(id: string, sportName: string): Promise<TLeagueSport> {
    const res = await authApi.post(API_PATHS.LEAGUES.LEAGUE_SPORTS(id), {
      sport_name: sportName,
    });
    return res.data;
  },

  /** Remove a sport from a league */
  async removeSport(id: string, sportName: string): Promise<void> {
    await authApi.delete(API_PATHS.LEAGUES.SPORT_DETAIL(id, sportName));
  },

  /** Add a lineup slot config to a league */
  async addLineupSlot(
    id: string,
    payload: {
      sport_name: string;
      position: string;
      min_count: number;
      max_count: number;
    },
  ): Promise<TLineupSlot> {
    const res = await authApi.post(API_PATHS.LEAGUES.LINEUP_SLOTS(id), payload);
    return res.data;
  },

  /** Build initial team for a budget-mode league */
  async buildTeam(
    id: string,
    payload: {
      team_name: string;
      player_ids: string[];
    },
  ): Promise<{ message: string; team_id: string }> {
    const res = await authApi.post(API_PATHS.LEAGUES.BUILD_TEAM(id), payload);
    return res.data;
  },

  /** Discard a player in budget-mode setup squad */
  async discardTeamPlayer(
    id: string,
    playerId: string,
  ): Promise<TDiscardPlayerResponse> {
    const res = await authApi.delete(
      API_PATHS.LEAGUES.DISCARD_TEAM_PLAYER(id, playerId),
    );
    return res.data;
  },

  /** Update league status */
  async updateStatus(
    id: string,
    newStatus: "setup" | "drafting" | "active" | "completed",
  ): Promise<TLeague> {
    const res = await authApi.patch(API_PATHS.LEAGUES.UPDATE_STATUS(id), {
      new_status: newStatus,
    });
    return res.data;
  },

  /** Generate transfer windows */
  async generateTransferWindows(
    id: string,
  ): Promise<{ message: string; count: number }> {
    const res = await authApi.post(API_PATHS.LEAGUES.GENERATE_WINDOWS(id));
    return res.data;
  },

  /** Make a transfer (swap player in vs player out) */
  async makeTransfer(
    id: string,
    payload: {
      player_in_id: string;
      player_out_id: string;
    },
  ): Promise<TTransfer> {
    const res = await authApi.post(API_PATHS.LEAGUES.TRANSFERS(id), payload);
    return res.data;
  },

  /** List transfer history */
  async getTransfers(id: string): Promise<TTransfer[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.TRANSFERS(id));
    return res.data;
  },

  /** List authenticated user's transfer history grouped by league */
  async getMyTransfersGrouped(): Promise<TUserTransferLeagueGroup[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.MY_TRANSFERS);
    return res.data;
  },

  /** Get the user's current lineup for a league */
  async getLineup(id: string): Promise<TLineupResponse> {
    const res = await authApi.get(API_PATHS.LEAGUES.LINEUP(id));
    return res.data;
  },

  /** Update the user's lineup for a league */
  async updateLineup(
    leagueId: string,
    data: TLineupUpdateRequest,
  ): Promise<TLineupResponse> {
    return (
      await authApi.patch<TLineupResponse>(
        API_PATHS.LEAGUES.LINEUP(leagueId),
        data,
      )
    ).data;
  },

  async getLeaderboard(
    leagueId: string,
    windowId?: string,
  ): Promise<TLeaderboardResponse> {
    return (
      await authApi.get<TLeaderboardResponse>(
        API_PATHS.LEAGUES.LEADERBOARD(leagueId, windowId),
      )
    ).data;
  },

  async getActiveWindow(leagueId: string): Promise<TTransferWindow> {
    return (
      await authApi.get<TTransferWindow>(
        API_PATHS.LEAGUES.ACTIVE_WINDOW(leagueId),
      )
    ).data;
  },

  async getDashboardStats(leagueId: string): Promise<TLeagueDashboardStats> {
    return (
      await authApi.get<TLeagueDashboardStats>(
        API_PATHS.LEAGUES.DASHBOARD_STATS(leagueId),
      )
    ).data;
  },

  async stageOut(payload: TStageOutRequest): Promise<TStageOutResponse> {
    const res = await authApi.post<TStageOutResponse>(
      API_PATHS.TRANSFERS.STAGE_OUT,
      payload,
    );
    return res.data;
  },

  async stageIn(payload: TStageInRequest): Promise<TStageInResponse> {
    const res = await authApi.post<TStageInResponse>(
      API_PATHS.TRANSFERS.STAGE_IN,
      payload,
    );
    return res.data;
  },

  async confirmTransfers(
    payload: TConfirmTransfersRequest,
  ): Promise<TConfirmTransfersResponse> {
    const res = await authApi.post<TConfirmTransfersResponse>(
      API_PATHS.TRANSFERS.CONFIRM,
      payload,
    );
    return res.data;
  },

  async cancelTransfers(): Promise<void> {
    await authApi.delete(API_PATHS.TRANSFERS.CANCEL, { data: {} });
  },
};
