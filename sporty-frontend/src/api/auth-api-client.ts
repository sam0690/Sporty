import axios from "axios";
import { API_PATHS } from "@/api/apiPath";
import { formatError } from "@/utils/api-Error";
import { publicApi, getCsrfToken, setCsrfToken } from "@/api/public-api-client";
import { emitAuthInvalidated } from "@/lib/auth-events";

/**
 * Auth Axios instance — uses httpOnly cookies for auth
 * and refreshes the session on 401.
 * 
 * API URL must be configured via NEXT_PUBLIC_API_URL environment variable.
 * 
 * Security: Tokens are stored in httpOnly cookies only.
 * JavaScript cannot read access or refresh tokens.
 * CSRF tokens are stored in memory (not localStorage).
 */
const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15_000,
});

// ── Request interceptor – attach CSRF token ────────────────────────
authApi.interceptors.request.use(
  (config) => {
    // Attach CSRF token for state-changing requests
    if (config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
      const token = getCsrfToken();
      if (token) {
        config.headers["X-CSRF-Token"] = token;
      }
    }
    return config;
  },
  (error) => Promise.reject(formatError(error)),
);

let refreshPromise: Promise<boolean> | null = null;

export const refreshAccessToken = async (): Promise<boolean> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = publicApi
    .post(API_PATHS.AUTH.REFRESH)
    .then(() => {
      return true;
    })
    .catch(() => {
      emitAuthInvalidated("refresh_failed");
      return false;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// ── Response interceptor – handle 401 & capture CSRF token ─────────
authApi.interceptors.response.use(
  (response) => {
    // Capture CSRF token from response headers
    const newToken = response.headers["x-csrf-token"];
    if (newToken) {
      setCsrfToken(newToken);
    }
    return response;
  },
  async (error) => {
    // Capture CSRF token from error response headers
    if (axios.isAxiosError(error) && error.response) {
      const newToken = error.response.headers["x-csrf-token"];
      if (newToken) {
        setCsrfToken(newToken);
      }
    }

    if (!axios.isAxiosError(error)) {
      return Promise.reject(formatError(error));
    }

    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };
    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(formatError(error));
    }

    originalRequest._retry = true;
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return Promise.reject(formatError(error));
    }

    return authApi(originalRequest);
  },
);

export { authApi };
