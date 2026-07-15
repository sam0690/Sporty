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
  TSeasonHistoryItem,
  TSport,
  TFantasyTeam,
  TLineupResponse,
  TLineupUpdateRequest,
  TGameweekRecapResponse,
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
  TFreeAgentPage,
  TFreeAgentClaimResponse,
  TWaiverClaim,
  TWaiverOrderEntry,
  TLeagueRoster,
  TTradeOffer,
  TTradeFairness,
  TPowerRankingEntry,
  TMatchup,
  TH2HStandingRow,
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
  async getMyTeam(id: string, signal?: AbortSignal): Promise<TFantasyTeam> {
    const res = await authApi.get(API_PATHS.LEAGUES.MY_TEAM(id), { signal });
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
    draft_pick_seconds?: number;
    is_head_to_head?: boolean;
    allow_midseason_join?: boolean;
    transfers_per_window?: number;
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

  /** Update a league's editable settings (owner only). Partial update. */
  async updateLeague(
    id: string,
    payload: { name?: string; is_public?: boolean },
  ): Promise<TLeague> {
    const res = await authApi.patch(API_PATHS.LEAGUES.UPDATE(id), payload);
    return res.data;
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

  /** List free agents (unowned players) in a draft league */
  async getFreeAgents(
    id: string,
    opts?: { position?: string; search?: string; limit?: number; offset?: number },
  ): Promise<TFreeAgentPage> {
    const res = await authApi.get(API_PATHS.LEAGUES.FREE_AGENTS(id, opts));
    return res.data;
  },

  /** Claim a free agent (add/drop) in a draft league */
  async claimFreeAgent(
    id: string,
    addPlayerId: string,
    dropPlayerId: string,
  ): Promise<TFreeAgentClaimResponse> {
    const res = await authApi.post(API_PATHS.LEAGUES.FREE_AGENT_CLAIM(id), {
      add_player_id: addPlayerId,
      drop_player_id: dropPlayerId,
    });
    return res.data;
  },

  /** List my waiver claims for a draft league */
  async getWaiverClaims(id: string): Promise<TWaiverClaim[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.WAIVERS(id));
    return res.data;
  },

  /** Get the league's rolling waiver order */
  async getWaiverOrder(id: string): Promise<TWaiverOrderEntry[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.WAIVER_ORDER(id));
    return res.data;
  },

  /** Submit a waiver claim (add/drop) */
  async submitWaiverClaim(
    id: string,
    addPlayerId: string,
    dropPlayerId: string,
  ): Promise<TWaiverClaim> {
    const res = await authApi.post(API_PATHS.LEAGUES.WAIVERS(id), {
      add_player_id: addPlayerId,
      drop_player_id: dropPlayerId,
    });
    return res.data;
  },

  /** Cancel a pending waiver claim */
  async cancelWaiverClaim(id: string, claimId: string): Promise<TWaiverClaim> {
    const res = await authApi.delete(API_PATHS.LEAGUES.WAIVER_CANCEL(id, claimId));
    return res.data;
  },

  /** Reorder my pending waiver claims (highest priority first) */
  async reorderWaiverClaims(
    id: string,
    orderedClaimIds: string[],
  ): Promise<TWaiverClaim[]> {
    const res = await authApi.put(API_PATHS.LEAGUES.WAIVER_ORDER(id), {
      ordered_claim_ids: orderedClaimIds,
    });
    return res.data;
  },

  /** List trades involving my team (incoming + outgoing) */
  async getTrades(id: string): Promise<TTradeOffer[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.TRADES(id));
    return res.data;
  },

  /** Every team's active roster (for building a trade) */
  async getTradeRosters(id: string): Promise<TLeagueRoster[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.TRADE_ROSTERS(id));
    return res.data;
  },

  /** Propose a trade to another team */
  async proposeTrade(
    id: string,
    payload: {
      to_team_id: string;
      offered_player_ids: string[];
      requested_player_ids: string[];
    },
  ): Promise<{ id: string; status: string }> {
    const res = await authApi.post(API_PATHS.LEAGUES.TRADES(id), payload);
    return res.data;
  },

  /** Rank movement, streaks, and Manager of the Week for the latest scored window */
  async getPowerRankings(id: string): Promise<TPowerRankingEntry[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.POWER_RANKINGS(id));
    return res.data;
  },

  /** Head-to-head matchups for a window (defaults to the current window). */
  async getMatchups(id: string, windowId?: string): Promise<TMatchup[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.MATCHUPS(id), {
      params: windowId ? { window_id: windowId } : undefined,
    });
    return res.data;
  },

  /** The whole season's head-to-head schedule, every gameweek. */
  async getFullSchedule(id: string): Promise<TMatchup[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.MATCHUPS(id), {
      params: { include_all: true },
    });
    return res.data;
  },

  /** Head-to-head W-L-T standings, sorted wins desc then points-for desc. */
  async getH2HStandings(id: string): Promise<TH2HStandingRow[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.MATCHUP_STANDINGS(id));
    return res.data;
  },

  /** Live fairness preview while building a trade (no side-effects) */
  async getTradeFairnessPreview(
    id: string,
    payload: { offered_player_ids: string[]; requested_player_ids: string[] },
  ): Promise<TTradeFairness> {
    const res = await authApi.post(
      API_PATHS.LEAGUES.TRADE_FAIRNESS_PREVIEW(id),
      payload,
    );
    return res.data;
  },

  /** Act on a trade: accept | reject | cancel | veto */
  async tradeAction(
    id: string,
    tradeId: string,
    action: "accept" | "reject" | "cancel" | "veto",
  ): Promise<{ id: string; status: string }> {
    const res = await authApi.post(
      API_PATHS.LEAGUES.TRADE_ACTION(id, tradeId, action),
    );
    return res.data;
  },

  /** List league members */
  async getMembers(id: string): Promise<TMembership[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.MEMBERS(id));
    return res.data;
  },

  /** Remove a member from a league (owner only) */
  async removeMember(id: string, membershipId: string): Promise<void> {
    await authApi.delete(API_PATHS.LEAGUES.MEMBER(id, membershipId));
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

  /** Re-point a secondary sport's season mapping (cross-sport scoring) */
  async remapSportSeason(id: string, sportName: string, seasonId: string): Promise<TLeagueSport> {
    const res = await authApi.patch(API_PATHS.LEAGUES.SPORT_SEASON(id, sportName), {
      season_id: seasonId,
    });
    return res.data;
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

  /** Generate auto-pick squad suggestions for a league. */
  async autoPickTeam(
    id: string,
    payload: { lockedPlayerIds?: string[] } = {},
  ): Promise<{
    players: Array<{
      id: string;
      name: string;
      sport_type: string;
      position: string;
      cost: string | number;
    }>;
    totalCost: string | number;
    budgetRemaining: string | number;
  }> {
    const res = await authApi.post(
      API_PATHS.LEAGUES.AUTO_PICK_TEAM(id),
      payload,
    );
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

  /** Start the next season of a completed league. `dynasty: true` carries
   * the entire roster over with no re-draft (see RenewLeagueModal). */
  async renewLeague(
    id: string,
    options: { targetSeasonId?: string; dynasty?: boolean } = {},
  ): Promise<TLeague> {
    const res = await authApi.post(API_PATHS.LEAGUES.RENEW(id), {
      target_season_id: options.targetSeasonId ?? null,
      dynasty: options.dynasty ?? false,
    });
    return res.data;
  },

  /** List every season in this league's rollover lineage, oldest first. */
  async getSeasonHistory(id: string): Promise<TSeasonHistoryItem[]> {
    const res = await authApi.get(API_PATHS.LEAGUES.SEASON_HISTORY(id));
    return res.data;
  },

  /** Toggle active-league mid-season joining (budget mode only). */
  async updateMidseasonJoin(
    id: string,
    allowMidseasonJoin: boolean,
  ): Promise<TLeague> {
    const res = await authApi.patch(
      API_PATHS.LEAGUES.UPDATE_MIDSEASON_JOIN(id),
      {
        allow_midseason_join: allowMidseasonJoin,
      },
    );
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

  /** Get the user's current (editable/upcoming) lineup for a league */
  async getLineup(id: string): Promise<TLineupResponse> {
    const res = await authApi.get(API_PATHS.LEAGUES.LINEUP(id));
    return res.data;
  },

  /** Get the user's lineup for the in-progress (live) gameweek */
  async getLiveLineup(id: string): Promise<TLineupResponse> {
    const res = await authApi.get(API_PATHS.LEAGUES.LIVE_LINEUP(id));
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

  /** The user's team for a scored gameweek, with per-player points + auto-subs */
  async getGameweekRecap(
    leagueId: string,
    windowId?: string,
    gameweek?: number,
  ): Promise<TGameweekRecapResponse> {
    const res = await authApi.get<TGameweekRecapResponse>(
      API_PATHS.LEAGUES.GAMEWEEK_RECAP(leagueId, windowId, gameweek),
    );
    return res.data;
  },

  async getLeaderboard(
    leagueId: string,
    windowId?: string,
    historical = true,
    gameweek?: number,
  ): Promise<TLeaderboardResponse> {
    const res = await authApi.get<TLeaderboardResponse>(
      API_PATHS.LEAGUES.LEADERBOARD(leagueId, windowId, historical, gameweek),
    );
    return res.data;
  },

  async getActiveWindow(leagueId: string): Promise<TTransferWindow> {
    return (
      await authApi.get<TTransferWindow>(
        API_PATHS.LEAGUES.ACTIVE_WINDOW(leagueId),
      )
    ).data;
  },

  async getEditableWindow(leagueId: string): Promise<TTransferWindow> {
    return (
      await authApi.get<TTransferWindow>(
        API_PATHS.LEAGUES.EDITABLE_WINDOW(leagueId),
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
