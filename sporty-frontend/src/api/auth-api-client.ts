import axios from "axios";
import { formatError } from "@/libs/api-error";
import {
    getLocalStorage,
    removeLocalStorage,
} from "@/libs/storage.local";
import { LocalStorageKeys } from "@/libs/storage.kyes";
import { ROUTES } from "@/libs/route.config";

/**
 * Auth Axios instance — attaches JWT from localStorage on every request
 * and redirects to login on 401.
 */
const authApi = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    timeout: 15_000,
});

// ── Request interceptor – attach token ─────────────────────────────
authApi.interceptors.request.use(
    (config) => {
        const token = getLocalStorage(LocalStorageKeys.TOKEN);
        if (token) {
            config.headers.set("Authorization", `Bearer ${token}`);
        }
        return config;
    },
    (error) => Promise.reject(formatError(error)),
);

// ── Response interceptor – handle 401 ──────────────────────────────
authApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            removeLocalStorage(LocalStorageKeys.TOKEN);
            removeLocalStorage(LocalStorageKeys.USER);

            if (typeof window !== "undefined") {
                window.location.href = ROUTES.LOGIN.path;
            }
        }

        return Promise.reject(formatError(error));
    },
);

export { authApi };
