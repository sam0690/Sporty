import axios from "axios";
import { API_PATHS } from "@/api/apiPath";
import { formatError } from "@/libs/api-error";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/libs/auth-tokens";
import { publicApi } from "@/api/public-api-client";
import { emitAuthInvalidated } from "@/libs/auth-events";

/**
 * Auth Axios instance — attaches JWT from memory on every request
 * and refreshes the session on 401.
 */
const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15_000,
});

type TokenPayload = {
  accessToken: string;
  refreshToken: string;
};

const parseTokenPayload = (value: unknown): TokenPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const data =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;

  const accessToken =
    typeof data.access_token === "string"
      ? data.access_token
      : typeof data.accessToken === "string"
        ? data.accessToken
        : null;

  const refreshToken =
    typeof data.refresh_token === "string"
      ? data.refresh_token
      : typeof data.refreshToken === "string"
        ? data.refreshToken
        : null;

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
};

let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = publicApi
    .post(API_PATHS.AUTH.REFRESH, { refresh_token: refreshToken })
    .then((response) => {
      const payload = parseTokenPayload(response.data);
      if (!payload) {
        clearAuthTokens();
        emitAuthInvalidated("refresh_failed");
        return null;
      }

      setAccessToken(payload.accessToken);
      setRefreshToken(payload.refreshToken);
      return payload.accessToken;
    })
    .catch(() => {
      clearAuthTokens();
      emitAuthInvalidated("refresh_failed");
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// ── Request interceptor – attach token ─────────────────────────────
authApi.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(formatError(error)),
);

// ── Response interceptor – handle 401 ──────────────────────────────
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
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
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      return Promise.reject(formatError(error));
    }

    if (originalRequest.headers) {
      originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
    }

    return authApi(originalRequest);
  },
);

export { authApi };
