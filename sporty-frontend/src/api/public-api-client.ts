import axios from "axios";
import { formatError } from "@/utils/api-Error";

/**
 * In-memory CSRF token store.
 * 
 * The token is read from X-CSRF-Token response headers on GET requests.
 * It is NEVER stored in localStorage (XSS protection).
 * It is sent in X-CSRF-Token header on state-changing requests.
 */
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/**
 * Public Axios instance — used for unauthenticated requests.
 *
 * Configuration
 * - Base URL must be set via NEXT_PUBLIC_API_URL environment variable.
 * - A response interceptor normalises errors into ApiError instances.
 * - CSRF token is automatically attached to state-changing requests.
 * 
 * Production Note: API_URL must be defined in environment variables.
 */
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15_000,
});

// ── Request interceptor – attach CSRF token ────────────────────────
publicApi.interceptors.request.use(
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

// ── Response interceptor – capture CSRF token & handle 403 ─────────
publicApi.interceptors.response.use(
  (response) => {
    // Capture CSRF token from response headers (set on GET requests)
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
    return Promise.reject(formatError(error));
  },
);

export { publicApi };
