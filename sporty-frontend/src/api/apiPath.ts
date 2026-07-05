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
    GOOGLE_LINK: "/auth/google/link",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
  },

  USERS: {
    LIST: "/users",
    ME_ACTIVITY: "/users/me/activity",
    DETAIL: (id: string) => `/users/${id}`,
    ACTIVITY: (id: string) => `/users/${id}/activity`,
    PUBLIC_STATS: (id: string) => `/users/${id}/public-stats`,
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    UPLOAD_AVATAR: (id: string) => `/users/${id}/avatar`,
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
    UPDATE_MIDSEASON_JOIN: (id: string) => `/leagues/${id}/midseason-join`,
    MEMBERS: (id: string) => `/leagues/${id}/members`,
    MY_TRANSFERS: "/leagues/me/transfers",
    MY_TEAM: (id: string) => `/leagues/${id}/my-team`,
    LEAGUE_SPORTS: (id: string) => `/leagues/${id}/sports`,
    SPORT_DETAIL: (id: string, sport: string) =>
      `/leagues/${id}/sports/${sport}`,
    LINEUP_SLOTS: (id: string) => `/leagues/${id}/lineup-slots`,
    LINEUP: (id: string) => `/leagues/${id}/my-team/lineup`,
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
    GENERATE_WINDOWS: (id: string) =>
      `/leagues/${id}/transfer-windows/generate`,
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
    DASHBOARD_STATS: (id: string) => `/leagues/${id}/dashboard/stats`,
  },

  PLAYERS: {
    LIST: "/players",
    DETAIL: (id: string) => `/players/${id}`,
    STATS: "/players/stats",
    STAT_DETAIL: (id: string, mwId: string) => `/players/${id}/stats/${mwId}`,
  },

  SCORING: {
    RULES: (sport: string) => `/scoring/rules/${sport}`,
    OVERRIDES: (id: string) => `/leagues/${id}/scoring-overrides`,
    OVERRIDE_DETAIL: (id: string, overrideId: string) =>
      `/leagues/${id}/scoring-overrides/${overrideId}`,
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
    PUBLIC: "/matches/public",
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
    AUDIT_LOG: (opts?: { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams();
      if (opts?.page != null) params.set("page", String(opts.page));
      if (opts?.pageSize != null) params.set("page_size", String(opts.pageSize));
      const query = params.toString();
      return `/admin/audit-log${query ? `?${query}` : ""}`;
    },
  },
} as const;
