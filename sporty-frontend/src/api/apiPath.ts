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
    REFRESH: "/auth/refresh",
    ME: "/auth/me",
    GOOGLE: "/auth/google",
    GOOGLE_LINK: "/auth/google/link",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
  },

  USERS: {
    LIST: "/users",
    DETAIL: (id: string) => `/users/${id}`,
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
  },

  LEAGUES: {
    LIST: "/leagues",
    CREATE: "/leagues",
    DISCOVER: "/leagues/discover",
    JOIN: "/leagues/join",
    SEASONS: "/leagues/seasons",
    SPORTS: "/leagues/sports",
    DETAIL: (id: string) => `/leagues/${id}`,
    UPDATE_STATUS: (id: string) => `/leagues/${id}/status`,
    MEMBERS: (id: string) => `/leagues/${id}/members`,
    MY_TEAM: (id: string) => `/leagues/${id}/my-team`,
    LEAGUE_SPORTS: (id: string) => `/leagues/${id}/sports`,
    SPORT_DETAIL: (id: string, sport: string) => `/leagues/${id}/sports/${sport}`,
    LINEUP_SLOTS: (id: string) => `/leagues/${id}/lineup-slots`,
    LINEUP: (id: string) => `/leagues/${id}/my-team/lineup`,
    DRAFT_START: (id: string) => `/leagues/${id}/draft/start`,
    DRAFT_PICK: (id: string) => `/leagues/${id}/draft/pick`,
    BUILD_TEAM: (id: string) => `/leagues/${id}/teams/build`,
    GENERATE_WINDOWS: (id: string) => `/leagues/${id}/transfer-windows/generate`,
    TRANSFERS: (id: string) => `/leagues/${id}/transfers`,
    LEADERBOARD: (id: string, windowId?: string) =>
      `/leagues/${id}/leaderboard${windowId ? `?window_id=${windowId}` : ""}`,
    ACTIVE_WINDOW: (id: string) => `/leagues/${id}/active-window`,
  },

  PLAYERS: {
    LIST: "/players",
    DETAIL: (id: string) => `/players/${id}`,
    STATS: (id: string, mwId: string) => `/players/${id}/stats/${mwId}`,
  },

  SCORING: {
    RULES: (sport: string) => `/scoring/rules/${sport}`,
    OVERRIDES: (id: string) => `/leagues/${id}/scoring-overrides`,
    OVERRIDE_DETAIL: (id: string, overrideId: string) =>
      `/leagues/${id}/scoring-overrides/${overrideId}`,
  },
} as const;
