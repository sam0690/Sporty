/**
 * Centralized API endpoint paths.
 *
 * Every backend endpoint used in the app MUST be registered here.
 * Services consume these constants — NEVER hard-code URLs elsewhere.
 */

export const API_PATHS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
    LOGOUT_ALL: "/auth/logout/all",
    REFRESH: "/auth/refresh",
    ME: "/auth/me",
    CHANGE_PASSWORD: "/auth/change-password",
    GOOGLE: "/auth/google",
    WS_TICKET: "/auth/ws-ticket",
    GOOGLE_LINK: "/auth/google/link",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    USERNAME_AVAILABLE: (username: string) =>
      `/auth/username-available?username=${encodeURIComponent(username)}`,
  },

  USERS: {
    LIST: "/users",
    ME_ACTIVITY: "/users/me/activity",
    DETAIL: (id: string) => `/users/${id}`,
    ACTIVITY: (id: string) => `/users/${id}/activity`,
    PUBLIC_STATS: (id: string) => `/users/${id}/public-stats`,
    PUBLIC_STATS_BY_USERNAME: (username: string) =>
      `/users/by-username/${encodeURIComponent(username)}/public-stats`,
    PUBLIC_MANAGER_STATS: (id: string) => `/users/public/${id}/stats`,
    PUBLIC_MANAGER_STATS_BY_USERNAME: (username: string) =>
      `/users/public/by-username/${encodeURIComponent(username)}/stats`,
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    UPLOAD_AVATAR: (id: string) => `/users/${id}/avatar`,
    FAVOURITE_TEAM: (sportId: string) => `/users/me/favourites/teams/${sportId}`,
    FAVOURITE_PLAYER: (sportId: string) => `/users/me/favourites/players/${sportId}`,
  },

  LEAGUES: {
    LIST: "/leagues",
    CREATE: "/leagues",
    DISCOVER: "/leagues/discover",
    JOIN: "/leagues/join",
    SEASONS: "/leagues/seasons",
    SPORTS: "/leagues/sports",
    DETAIL: (id: string) => `/leagues/${id}`,
    DELETE: (id: string) => `/leagues/${id}`,
    UPDATE: (id: string) => `/leagues/${id}`,
    LEAVE: (id: string) => `/leagues/${id}/leave`,
    UPDATE_STATUS: (id: string) => `/leagues/${id}/status`,
    RENEW: (id: string) => `/leagues/${id}/renew`,
    SEASON_HISTORY: (id: string) => `/leagues/${id}/seasons`,
    UPDATE_MIDSEASON_JOIN: (id: string) => `/leagues/${id}/midseason-join`,
    MEMBERS: (id: string) => `/leagues/${id}/members`,
    MEMBER: (id: string, membershipId: string) =>
      `/leagues/${id}/members/${membershipId}`,
    MY_TRANSFERS: "/leagues/me/transfers",
    MY_TEAM: (id: string) => `/leagues/${id}/my-team`,
    LEAGUE_SPORTS: (id: string) => `/leagues/${id}/sports`,
    SPORT_DETAIL: (id: string, sport: string) =>
      `/leagues/${id}/sports/${sport}`,
    SPORT_SEASON: (id: string, sport: string) =>
      `/leagues/${id}/sports/${sport}/season`,
    LINEUP_SLOTS: (id: string) => `/leagues/${id}/lineup-slots`,
    LINEUP: (id: string) => `/leagues/${id}/my-team/lineup`,
    LIVE_LINEUP: (id: string) => `/leagues/${id}/my-team/live-lineup`,
    GAMEWEEK_RECAP: (id: string, windowId?: string, gameweek?: number) => {
      const params = new URLSearchParams();
      if (windowId) params.set("window_id", windowId);
      if (gameweek != null) params.set("gameweek", String(gameweek));
      const query = params.toString();
      return `/leagues/${id}/my-team/gameweek-recap${query ? `?${query}` : ""}`;
    },
    DRAFT_START: (id: string) => `/leagues/${id}/draft/start`,
    DRAFT_PICK: (id: string) => `/leagues/${id}/draft/pick`,
    DRAFT_TURN: (id: string) => `/leagues/${id}/draft/turn`,
    BUILD_TEAM: (id: string) => `/leagues/${id}/teams/build`,
    AUTO_PICK_TEAM: (id: string) => `/leagues/${id}/auto-pick`,
    DISCARD_TEAM_PLAYER: (id: string, playerId: string) =>
      `/leagues/${id}/teams/players/${playerId}`,
    TRANSFERS: (id: string) => `/leagues/${id}/transfers`,
    FREE_AGENTS: (
      id: string,
      opts?: { position?: string; search?: string; limit?: number; offset?: number },
    ) => {
      const params = new URLSearchParams();
      if (opts?.position) params.set("position", opts.position);
      if (opts?.search) params.set("search", opts.search);
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.offset != null) params.set("offset", String(opts.offset));
      const query = params.toString();
      return `/leagues/${id}/free-agents${query ? `?${query}` : ""}`;
    },
    FREE_AGENT_CLAIM: (id: string) => `/leagues/${id}/free-agents/claim`,
    WAIVERS: (id: string) => `/leagues/${id}/waivers`,
    WAIVER_ORDER: (id: string) => `/leagues/${id}/waivers/order`,
    WAIVER_CANCEL: (id: string, claimId: string) =>
      `/leagues/${id}/waivers/${claimId}`,
    TRADES: (id: string) => `/leagues/${id}/trades`,
    TRADE_ROSTERS: (id: string) => `/leagues/${id}/trades/rosters`,
    TRADE_ACTION: (id: string, tradeId: string, action: string) =>
      `/leagues/${id}/trades/${tradeId}/${action}`,
    MATCHUPS: (id: string) => `/leagues/${id}/matchups`,
    MATCHUP_STANDINGS: (id: string) => `/leagues/${id}/matchups/standings`,
    TRADE_FAIRNESS_PREVIEW: (id: string) => `/leagues/${id}/trades/fairness-preview`,
    LEADERBOARD: (
      id: string,
      windowId?: string,
      historical = true,
      gameweek?: number,
    ) => {
      const params = new URLSearchParams();
      if (windowId) params.set("window_id", windowId);
      if (gameweek != null) params.set("gameweek", String(gameweek));
      if (!historical) params.set("historical", "false");
      const query = params.toString();
      return `/leagues/${id}/leaderboard${query ? `?${query}` : ""}`;
    },
    ACTIVE_WINDOW: (id: string) => `/leagues/${id}/active-window`,
    EDITABLE_WINDOW: (id: string) => `/leagues/${id}/editable-window`,
    SEASON_STATE: (id: string) => `/leagues/${id}/season-state`,
    DASHBOARD_STATS: (id: string) => `/leagues/${id}/dashboard/stats`,
    POWER_RANKINGS: (id: string) => `/leagues/${id}/power-rankings`,
    CHAT_MESSAGES: (id: string) => `/leagues/${id}/chat/messages`,
    CHAT_MESSAGE_DETAIL: (id: string, messageId: string) =>
      `/leagues/${id}/chat/messages/${messageId}`,
    CHAT_MESSAGE_REACTIONS: (id: string, messageId: string) =>
      `/leagues/${id}/chat/messages/${messageId}/reactions`,
    ACTIVITY: (id: string) => `/leagues/${id}/activity`,
  },

  PLAYERS: {
    LIST: "/players",
    DETAIL: (id: string) => `/players/${id}`,
    STATS: "/players/stats",
    STAT_DETAIL: (id: string, mwId: string) => `/players/${id}/stats/${mwId}`,
    RECENT_STATS: (id: string) => `/players/${id}/recent-stats`,
    TEAMS: "/players/teams",
    PUBLIC_DETAIL: (id: string) => `/players/public/${id}`,
    PUBLIC_RECENT_STATS: (id: string) => `/players/public/${id}/recent-stats`,
  },

  SCORING: {
    RULES: (sport: string) => `/scoring/rules/${sport}`,
  },

  OPTIMIZATION: {
    LINEUP: "/optimization/lineup",
  },

  TRANSFERS: {
    STAGE_OUT: "/transfers/stage-out",
    STAGE_IN: "/transfers/stage-in",
    CONFIRM: "/transfers/confirm",
    CANCEL: "/transfers/cancel",
  },

  MATCHES: {
    LIST: "/matches",
    LIVE_FAVOURITES: "/matches/live-for-favourites",
  },

  FIXTURES: {
    LIST: "/fixtures",
    NEXT: "/fixtures/next",
  },

  COMPETITIONS: {
    LIST: "/competitions",
    STANDINGS: (tag: string) => `/competitions/${tag}/standings`,
    SCORERS: (tag: string) => `/competitions/${tag}/scorers`,
    MATCHES: (tag: string) => `/competitions/${tag}/matches`,
    MATCH: (tag: string, id: string) => `/competitions/${tag}/matches/${id}`,
  },

  PREDICTIONS: {
    CREATE: "/predictions",
    ME: (resolved?: boolean) =>
      resolved == null ? "/predictions/me" : `/predictions/me?resolved=${resolved}`,
    FOR_MATCH: (matchId: string) => `/predictions/match/${matchId}`,
    LEADERBOARD: (leagueId?: string) =>
      leagueId
        ? `/predictions/leaderboard?league_id=${leagueId}`
        : "/predictions/leaderboard",
  },

  ADMIN: {
    USERS: (opts?: {
      page?: number;
      pageSize?: number;
      search?: string;
      role?: string;
      isActive?: boolean;
    }) => {
      const params = new URLSearchParams();
      if (opts?.page != null) params.set("page", String(opts.page));
      if (opts?.pageSize != null) params.set("page_size", String(opts.pageSize));
      if (opts?.search) params.set("search", opts.search);
      if (opts?.role) params.set("role", opts.role);
      if (opts?.isActive != null) params.set("is_active", String(opts.isActive));
      const query = params.toString();
      return `/admin/users${query ? `?${query}` : ""}`;
    },
    USER_DETAIL: (id: string) => `/admin/users/${id}`,
    USER_SUSPEND: (id: string) => `/admin/users/${id}/suspend`,
    USER_REACTIVATE: (id: string) => `/admin/users/${id}/reactivate`,
    USER_FORCE_LOGOUT: (id: string) => `/admin/users/${id}/force-logout`,
    USER_ROLE: (id: string) => `/admin/users/${id}/role`,
    USER_DELETE: (id: string) => `/admin/users/${id}`,
    LEAGUES: (opts?: { page?: number; pageSize?: number; search?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (opts?.page != null) params.set("page", String(opts.page));
      if (opts?.pageSize != null) params.set("page_size", String(opts.pageSize));
      if (opts?.search) params.set("search", opts.search);
      if (opts?.status) params.set("status", opts.status);
      const query = params.toString();
      return `/admin/leagues${query ? `?${query}` : ""}`;
    },
    LEAGUE_STATUS: (id: string) => `/admin/leagues/${id}/status`,
    LEAGUE_DELETE: (id: string) => `/admin/leagues/${id}`,
    LEAGUE_SETTINGS: (id: string) => `/admin/leagues/${id}/settings`,
    SEASONS: "/admin/seasons",
    SEASONS_UNIFIED: "/admin/seasons/unified",
    SEASON_DETAIL: (id: string) => `/admin/seasons/${id}`,
    SEASON_GENERATE_WINDOWS: (id: string) => `/admin/seasons/${id}/generate-windows`,
    AUDIT_LOG: (opts?: { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams();
      if (opts?.page != null) params.set("page", String(opts.page));
      if (opts?.pageSize != null) params.set("page_size", String(opts.pageSize));
      const query = params.toString();
      return `/admin/audit-log${query ? `?${query}` : ""}`;
    },

    RECALCULATE_WINDOW_SCORE: (leagueId: string, windowId: string) =>
      `/admin/leagues/${leagueId}/transfer-windows/${windowId}/recalculate-score`,
    RECALCULATE_ACTIVE_WINDOWS: "/admin/scoring/recalculate-active",
    WINDOW_LOCK: (windowId: string) => `/admin/transfer-windows/${windowId}/lock`,

    PLAYER_DETAIL: (id: string) => `/admin/players/${id}`,
    PLAYER_REPRICE: "/admin/players/reprice",

    TRADE_VETO: (leagueId: string, tradeId: string) => `/admin/leagues/${leagueId}/trades/${tradeId}/veto`,
    TRADE_CANCEL: (leagueId: string, tradeId: string) => `/admin/leagues/${leagueId}/trades/${tradeId}/cancel`,
    WAIVER_CANCEL: (leagueId: string, claimId: string) => `/admin/leagues/${leagueId}/waivers/${claimId}/cancel`,
    TRANSFER_REVERSE: (transferId: string) => `/admin/transfers/${transferId}/reverse`,

    JOBS_CELERY: "/admin/jobs/celery",
    JOBS_KAFKA: "/admin/jobs/kafka",

    CONFIG_LIST: "/admin/config",
    CONFIG_REALTIME_PIPELINE: "/admin/config/realtime-pipeline",
    CONFIG_LIVE_POLLING: "/admin/config/live-polling",

    TICKETS: (opts?: { page?: number; pageSize?: number; status?: string }) => {
      const params = new URLSearchParams();
      if (opts?.page != null) params.set("page", String(opts.page));
      if (opts?.pageSize != null) params.set("page_size", String(opts.pageSize));
      if (opts?.status) params.set("status", opts.status);
      const query = params.toString();
      return `/admin/tickets${query ? `?${query}` : ""}`;
    },
    TICKET_DETAIL: (id: string) => `/admin/tickets/${id}`,
    TICKET_MESSAGES: (id: string) => `/admin/tickets/${id}/messages`,

    LEAGUE_TRANSFER_WINDOWS: (leagueId: string) => `/admin/leagues/${leagueId}/transfer-windows`,
    LEAGUE_TRADES: (leagueId: string, onlyActionable = true) =>
      `/admin/leagues/${leagueId}/trades?only_actionable=${onlyActionable}`,
    LEAGUE_WAIVERS: (leagueId: string, onlyPending = true) =>
      `/admin/leagues/${leagueId}/waivers?only_pending=${onlyPending}`,
    LEAGUE_TRANSFERS: (leagueId: string, onlyReversible = false) =>
      `/admin/leagues/${leagueId}/transfers?only_reversible=${onlyReversible}`,
  },

  SUPPORT: {
    TICKETS: "/support/tickets",
    TICKET_DETAIL: (id: string) => `/support/tickets/${id}`,
    TICKET_MESSAGES: (id: string) => `/support/tickets/${id}/messages`,
  },
} as const;
