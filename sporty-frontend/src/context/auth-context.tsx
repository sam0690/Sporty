"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { API_PATHS } from "@/api/apiPath";
import { authApi } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import { LocalStorageKeys } from "@/libs/storage.kyes";
import {
    getLocalStorage,
    removeLocalStorage,
    setLocalStorage,
} from "@/libs/storage.local";

export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
}

type AuthAction = "login" | "register" | "logout" | "forgotPassword" | "resetPassword";

type AuthResult = {
    success: boolean;
    error?: string;
};

/* ── Types ────────────────────────────────────────────────────────── */

export interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    actionLoading: Record<AuthAction, boolean>;
    login: (email: string, password: string) => Promise<AuthResult>;
    register: (name: string, email: string, password: string) => Promise<AuthResult>;
    logout: () => Promise<AuthResult>;
    forgotPassword: (email: string) => Promise<AuthResult>;
    resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
}

const initialActionLoading: Record<AuthAction, boolean> = {
    login: false,
    register: false,
    logout: false,
    forgotPassword: false,
    resetPassword: false,
};

type AnyObject = Record<string, unknown>;

const toRecord = (value: unknown): AnyObject => {
    if (!value || typeof value !== "object") {
        return {};
    }
    return value as AnyObject;
};

const readString = (record: AnyObject, key: string): string => {
    const value = record[key];
    return typeof value === "string" ? value : "";
};

const toUser = (value: unknown): User => {
    const source = toRecord(value);
    const firstName = readString(source, "firstName");
    const lastName = readString(source, "lastName");
    const fullName = `${firstName} ${lastName}`.trim();

    return {
        id: readString(source, "id") || crypto.randomUUID(),
        name: readString(source, "name") || fullName || readString(source, "username") || "Sporty User",
        email: readString(source, "email"),
        avatar: readString(source, "avatar") || readString(source, "profileImage"),
    };
};

const parseAuthPayload = (value: unknown): {
    token: string;
    user: User | null;
} => {
    const root = toRecord(value);
    const nestedData = toRecord(root.data);
    const data = Object.keys(nestedData).length > 0 ? nestedData : root;

    const token =
        readString(data, "access_token") ||
        readString(data, "accessToken") ||
        readString(data, "token") ||
        readString(root, "access_token") ||
        readString(root, "accessToken") ||
        readString(root, "token");

    const rawUser = data.user ?? root.user ?? (readString(data, "email") ? data : null);
    return {
        token,
        user: rawUser ? toUser(rawUser) : null,
    };
};

const readStoredUser = (): User | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const raw = window.localStorage.getItem(LocalStorageKeys.USER);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as User;
    } catch {
        return null;
    }
};

const writeAuthToStorage = (token: string, user: User): void => {
    setLocalStorage(LocalStorageKeys.TOKEN, token);
    setLocalStorage(LocalStorageKeys.USER, JSON.stringify(user));
};

const clearAuthStorage = (): void => {
    removeLocalStorage(LocalStorageKeys.TOKEN);
    removeLocalStorage(LocalStorageKeys.USER);
};

export const getToken = (): string | null => {
    return getLocalStorage(LocalStorageKeys.TOKEN);
};

/* ── Context ──────────────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ── Provider ─────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [bootstrapping, setBootstrapping] = useState(true);
    const [actionLoading, setActionLoading] = useState(initialActionLoading);

    const setLoading = useCallback((action: AuthAction, loading: boolean): void => {
        setActionLoading((prev) => ({ ...prev, [action]: loading }));
    }, []);

    const isLoading =
        bootstrapping ||
        Object.values(actionLoading).some(Boolean);

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const token = getToken();
            const savedUser = readStoredUser();
            if (token && savedUser) {
                setUser(savedUser);
            } else {
                clearAuthStorage();
            }
        } finally {
            setBootstrapping(false);
        }
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
        setLoading("login", true);
        try {
            const response = await publicApi.post(API_PATHS.AUTH.LOGIN, { email, password });
            const payload = parseAuthPayload(response.data);

            if (!payload.token || !payload.user) {
                return { success: false, error: "Invalid login response from server." };
            }

            writeAuthToStorage(payload.token, payload.user);
            setUser(payload.user);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Login failed.";
            return { success: false, error: message };
        } finally {
            setLoading("login", false);
        }
    }, [setLoading]);

    const register = useCallback(async (name: string, email: string, password: string): Promise<AuthResult> => {
        setLoading("register", true);
        try {
            const [firstName, ...restName] = name.trim().split(/\s+/);
            const lastName = restName.join(" ");

            const response = await publicApi.post(API_PATHS.AUTH.REGISTER, {
                firstName: firstName || name.trim(),
                lastName,
                email,
                password,
            });

            const payload = parseAuthPayload(response.data);
            if (payload.token && payload.user) {
                writeAuthToStorage(payload.token, payload.user);
                setUser(payload.user);
            }

            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Registration failed.";
            return { success: false, error: message };
        } finally {
            setLoading("register", false);
        }
    }, [setLoading]);

    const logout = useCallback(async (): Promise<AuthResult> => {
        setLoading("logout", true);
        try {
            const token = getToken();
            if (token) {
                await authApi.post(API_PATHS.AUTH.LOGOUT, {});
            }
            clearAuthStorage();
            setUser(null);
            return { success: true };
        } catch (error) {
            clearAuthStorage();
            setUser(null);
            const message = error instanceof Error ? error.message : "Logout failed.";
            return { success: true, error: message };
        } finally {
            setLoading("logout", false);
        }
    }, [setLoading]);

    const forgotPassword = useCallback(async (email: string): Promise<AuthResult> => {
        setLoading("forgotPassword", true);
        try {
            await publicApi.post(API_PATHS.AUTH.FORGOT_PASSWORD, { email });
            return { success: true };
        } catch {
            // Intentionally return success to avoid account enumeration and
            // keep UX consistent even if backend endpoint is unavailable.
            return { success: true };
        } finally {
            setLoading("forgotPassword", false);
        }
    }, [setLoading]);

    const resetPassword = useCallback(async (token: string, newPassword: string): Promise<AuthResult> => {
        setLoading("resetPassword", true);
        try {
            if (!token.trim()) {
                return { success: false, error: "Reset token is required." };
            }

            await publicApi.post(API_PATHS.AUTH.RESET_PASSWORD, {
                token,
                new_password: newPassword,
            });
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Reset failed.";
            return { success: false, error: message };
        } finally {
            setLoading("resetPassword", false);
        }
    }, [setLoading]);

    const value = useMemo<AuthContextType>(
        () => ({
            user,
            isLoading,
            actionLoading,
            login,
            register,
            logout,
            forgotPassword,
            resetPassword,
        }),
        [
            user,
            isLoading,
            actionLoading,
            login,
            register,
            logout,
            forgotPassword,
            resetPassword,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
