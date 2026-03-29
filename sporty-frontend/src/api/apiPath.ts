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
    },

    USERS: {
        LIST: "/users",
        DETAIL: (id: string) => `/users/${id}`,
        UPDATE: (id: string) => `/users/${id}`,
        DELETE: (id: string) => `/users/${id}`,
    },

    // ── Add more resource groups below ──────────────────────────────
    // BRANDS: {
    //   LIST: "/brands",
    //   DETAIL: (id: string) => `/brands/${id}`,
    // },
} as const;
