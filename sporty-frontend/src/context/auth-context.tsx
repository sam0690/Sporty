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
import type { TUser } from "@/types";
import {
    getLocalStorage,
    setLocalStorage,
    removeLocalStorage,
} from "@/libs/storage.local";
import { LocalStorageKeys } from "@/libs/storage.kyes";

/* ── Types ────────────────────────────────────────────────────────── */

interface AuthState {
    user: TUser | null;
    token: string | null;
    isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
    login: (token: string, user: TUser) => void;
    logout: () => void;
}

/* ── Context ──────────────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ── Provider ─────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isAuthenticated: false,
    });

    // Hydrate from localStorage on mount
    useEffect(() => {
        const token = getLocalStorage(LocalStorageKeys.TOKEN);
        const userRaw = getLocalStorage(LocalStorageKeys.USER);

        if (token && userRaw) {
            try {
                const user: TUser = JSON.parse(userRaw);
                setState({ user, token, isAuthenticated: true });
            } catch {
                removeLocalStorage(LocalStorageKeys.TOKEN);
                removeLocalStorage(LocalStorageKeys.USER);
            }
        }
    }, []);

    const login = useCallback((token: string, user: TUser) => {
        setLocalStorage(LocalStorageKeys.TOKEN, token);
        setLocalStorage(LocalStorageKeys.USER, JSON.stringify(user));
        setState({ user, token, isAuthenticated: true });
    }, []);

    const logout = useCallback(() => {
        removeLocalStorage(LocalStorageKeys.TOKEN);
        removeLocalStorage(LocalStorageKeys.USER);
        setState({ user: null, token: null, isAuthenticated: false });
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ ...state, login, logout }),
        [state, login, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
