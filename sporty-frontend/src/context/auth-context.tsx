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
import { authApi, refreshAccessToken } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import {
  clearAuthTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/libs/auth-tokens";
import { subscribeAuthInvalidated } from "@/libs/auth-events";
import { ROUTES } from "@/libs/route.config";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

type AuthAction =
  | "login"
  | "register"
  | "logout"
  | "forgotPassword"
  | "resetPassword"
  | "google";

type AuthResult = {
  success: boolean;
  error?: string;
  message?: string;
};

/* ── Types ────────────────────────────────────────────────────────── */

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  actionLoading: Record<AuthAction, boolean>;
  login: (username: string, password: string) => Promise<AuthResult>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  loginWithGoogle: (idToken: string) => Promise<AuthResult>;
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
  google: false,
};

type AnyObject = Record<string, unknown>;

type TokenPayload = {
  accessToken: string;
  refreshToken: string;
};

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
  const username = readString(source, "username");
  const email = readString(source, "email");
  const avatar =
    readString(source, "avatar_url") || readString(source, "avatar");

  return {
    id: readString(source, "id") || crypto.randomUUID(),
    name: username || email || "Sporty User",
    email,
    avatar,
  };
};

const parseTokenPayload = (value: unknown): TokenPayload | null => {
  const root = toRecord(value);
  const nestedData = toRecord(root.data);
  const data = Object.keys(nestedData).length > 0 ? nestedData : root;

  const accessToken =
    readString(data, "access_token") || readString(data, "accessToken");

  const refreshToken =
    readString(data, "refresh_token") || readString(data, "refreshToken");

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
};

/* ── Context ──────────────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ── Provider ─────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [actionLoading, setActionLoading] = useState(initialActionLoading);
  const router = useRouter();

  const setLoading = useCallback(
    (action: AuthAction, loading: boolean): void => {
      setActionLoading((prev) => ({ ...prev, [action]: loading }));
    },
    [],
  );

  const isLoading = bootstrapping || Object.values(actionLoading).some(Boolean);

  // Hydrate from refresh token on mount
  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async (): Promise<void> => {
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearAuthTokens();
          return;
        }

        const token = await refreshAccessToken();
        if (!token) {
          clearAuthTokens();
          return;
        }

        const response = await authApi.get(API_PATHS.AUTH.ME);
        if (isMounted) {
          setUser(toUser(response.data));
        }
      } catch {
        clearAuthTokens();
      } finally {
        if (isMounted) {
          setBootstrapping(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeAuthInvalidated(() => {
      clearAuthTokens();
      setUser(null);
      router.replace(ROUTES.LOGIN.path);
    });
  }, [router]);

  const login = useCallback(
    async (username: string, password: string): Promise<AuthResult> => {
      setLoading("login", true);
      try {
        const response = await publicApi.post(API_PATHS.AUTH.LOGIN, {
          username,
          password,
        });
        const payload = parseTokenPayload(response.data);

        if (!payload) {
          return {
            success: false,
            error: "Invalid login response from server.",
          };
        }

        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);

        const meResponse = await authApi.get(API_PATHS.AUTH.ME);
        setUser(toUser(meResponse.data));
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Login failed.";
        return { success: false, error: message };
      } finally {
        setLoading("login", false);
      }
    },
    [setLoading],
  );

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string,
    ): Promise<AuthResult> => {
      setLoading("register", true);
      try {
        const response = await publicApi.post(API_PATHS.AUTH.REGISTER, {
          username,
          email,
          password,
          auto_login: true,
        });

        const payload = parseTokenPayload(response.data);
        if (payload) {
          setAccessToken(payload.accessToken);
          setRefreshToken(payload.refreshToken);

          const meResponse = await authApi.get(API_PATHS.AUTH.ME);
          setUser(toUser(meResponse.data));
        }

        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Registration failed.";
        return { success: false, error: message };
      } finally {
        setLoading("register", false);
      }
    },
    [setLoading],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string): Promise<AuthResult> => {
      setLoading("google", true);
      try {
        const response = await publicApi.post(API_PATHS.AUTH.GOOGLE, {
          id_token: idToken,
        });
        const payload = parseTokenPayload(response.data);

        if (!payload) {
          return { success: false, error: "Invalid Google login response." };
        }

        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);

        const meResponse = await authApi.get(API_PATHS.AUTH.ME);
        setUser(toUser(meResponse.data));
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Google login failed.";
        return { success: false, error: message };
      } finally {
        setLoading("google", false);
      }
    },
    [setLoading],
  );

  const logout = useCallback(async (): Promise<AuthResult> => {
    setLoading("logout", true);
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await authApi.post(API_PATHS.AUTH.LOGOUT, {
          refresh_token: refreshToken,
        });
      }
      clearAuthTokens();
      setUser(null);
      return { success: true };
    } catch (error) {
      clearAuthTokens();
      setUser(null);
      const message = error instanceof Error ? error.message : "Logout failed.";
      return { success: true, error: message };
    } finally {
      setLoading("logout", false);
    }
  }, [setLoading]);

  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      setLoading("forgotPassword", true);
      try {
        const response = await publicApi.post(API_PATHS.AUTH.FORGOT_PASSWORD, {
          email,
        });
        const detail =
          typeof response?.data?.detail === "string"
            ? response.data.detail
            : "If an account exists with that email, you'll receive a reset link.";
        return { success: true, message: detail };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to submit your reset request. Please try again.";
        return { success: false, error: message };
      } finally {
        setLoading("forgotPassword", false);
      }
    },
    [setLoading],
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string): Promise<AuthResult> => {
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
        const message =
          error instanceof Error ? error.message : "Reset failed.";
        return { success: false, error: message };
      } finally {
        setLoading("resetPassword", false);
      }
    },
    [setLoading],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      actionLoading,
      login,
      register,
      loginWithGoogle,
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
      loginWithGoogle,
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
