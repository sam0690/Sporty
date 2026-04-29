import axios from "axios";
import { formatError } from "@/libs/api-error";

/**
 * Public Axios instance — used for unauthenticated requests.
 *
 * Configuration
 * - Base URL is read from NEXT_PUBLIC_API_URL env variable.
 * - A response interceptor normalises errors into ApiError instances.
 */
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15_000,
});

// ── Request interceptor ────────────────────────────────────────────
publicApi.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(formatError(error)),
);

// ── Response interceptor ───────────────────────────────────────────
publicApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(formatError(error)),
);

export { publicApi };
