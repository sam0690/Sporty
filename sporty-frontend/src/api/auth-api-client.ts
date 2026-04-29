import axios from "axios";
import { API_PATHS } from "@/api/apiPath";
import { formatError } from "@/libs/api-error";
import { publicApi } from "@/api/public-api-client";
import { emitAuthInvalidated } from "@/libs/auth-events";

/**
 * Auth Axios instance — attaches JWT from memory on every request
 * and refreshes the session on 401.
 */
const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15_000,
});

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

// ── Request interceptor – attach token ─────────────────────────────
authApi.interceptors.request.use(
  (config) => config,
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
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return Promise.reject(formatError(error));
    }

    return authApi(originalRequest);
  },
);

export { authApi };
