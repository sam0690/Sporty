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
import { subscribeAuthInvalidated } from "@/lib/auth-events";
import { ROUTES } from "@/lib/route.config";
import { useRouter } from "next/navigation";
import { isApiError } from "@/utils/api-Error";

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
  code?: string;
  email?: string;
  googleIdToken?: string;
};

type PendingGoogleLink = {
  email?: string;
  googleIdToken: string;
};

const PENDING_GOOGLE_LINK_KEY = "sporty.pending_google_link";

const readPendingGoogleLink = (): PendingGoogleLink | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(PENDING_GOOGLE_LINK_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingGoogleLink>;
    if (typeof parsed.googleIdToken === "string" && parsed.googleIdToken) {
      return {
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        googleIdToken: parsed.googleIdToken,
      };
    }
  } catch {
    // Ignore malformed session storage.
  }

  return null;
};

const writePendingGoogleLink = (value: PendingGoogleLink): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PENDING_GOOGLE_LINK_KEY, JSON.stringify(value));
};

const clearPendingGoogleLink = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_GOOGLE_LINK_KEY);
};

/* ── Types ────────────────────────────────────────────────────────── */

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  actionLoading: Record<AuthAction, boolean>;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  loginWithGoogle: (idToken: string) => Promise<AuthResult>;
  linkGoogle: (idToken: string) => Promise<AuthResult>;
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

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async (): Promise<void> => {
      try {
        const response = await authApi.get(API_PATHS.AUTH.ME);
        if (isMounted) {
          setUser(toUser(response.data));
        }
      } catch {
        // Auth tokens are httpOnly cookies - handled by backend
        // No client-side token cleanup needed
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
      // Auth tokens are httpOnly cookies - handled by backend
      // Only clear user state client-side
      setUser(null);
      router.replace(ROUTES.LOGIN.path);
    });
  }, [router]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<AuthResult> => {
      setLoading("login", true);
      try {
        await publicApi.post(API_PATHS.AUTH.LOGIN, {
          identifier,
          password,
        });
        const meResponse = await authApi.get(API_PATHS.AUTH.ME);
        setUser(toUser(meResponse.data));

        const pendingGoogleLink = readPendingGoogleLink();
        if (pendingGoogleLink) {
          try {
            await authApi.post(API_PATHS.AUTH.GOOGLE_LINK, {
              id_token: pendingGoogleLink.googleIdToken,
            });
            const linkedMeResponse = await authApi.get(API_PATHS.AUTH.ME);
            setUser(toUser(linkedMeResponse.data));
          } catch {
            // Keep the original login session even if linking fails.
          } finally {
            clearPendingGoogleLink();
          }
        }

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
        await publicApi.post(API_PATHS.AUTH.REGISTER, {
          username,
          email,
          password,
          auto_login: true,
        });

        const meResponse = await authApi.get(API_PATHS.AUTH.ME);
        setUser(toUser(meResponse.data));

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

  const linkGoogle = useCallback(
    async (idToken: string): Promise<AuthResult> => {
      setLoading("google", true);
      try {
        const response = await authApi.post(API_PATHS.AUTH.GOOGLE_LINK, {
          id_token: idToken,
        });
        const linkedUser = response.data?.user;
        if (linkedUser) {
          setUser(toUser(linkedUser));
        }
        clearPendingGoogleLink();
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Google linking failed.";
        return { success: false, error: message };
      } finally {
        setLoading("google", false);
      }
    },
    [setLoading],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string): Promise<AuthResult> => {
      setLoading("google", true);
      try {
        await publicApi.post(API_PATHS.AUTH.GOOGLE, {
          id_token: idToken,
        });
        const meResponse = await authApi.get(API_PATHS.AUTH.ME);
        setUser(toUser(meResponse.data));
        return { success: true };
      } catch (error) {
        if (
          isApiError(error) &&
          error.code === "account_exists_link_required"
        ) {
          const details =
            error.details && typeof error.details === "object"
              ? (error.details as Record<string, unknown>)
              : {};
          const email =
            typeof details.email === "string" ? details.email : undefined;
          const googleIdToken =
            typeof details.googleIdToken === "string"
              ? details.googleIdToken
              : idToken;

          if (user) {
            return linkGoogle(googleIdToken);
          }

          writePendingGoogleLink({
            email,
            googleIdToken,
          });

          return {
            success: false,
            code: error.code,
            email,
            googleIdToken,
            error:
              error.message || "Account exists with different login method.",
          };
        }

        const message =
          error instanceof Error ? error.message : "Google login failed.";
        return { success: false, error: message };
      } finally {
        setLoading("google", false);
      }
    },
    [linkGoogle, setLoading, user],
  );

  const logout = useCallback(async (): Promise<AuthResult> => {
    setLoading("logout", true);
    try {
      // Backend clears httpOnly cookies via set_cookie with maxAge=0
      await authApi.post(API_PATHS.AUTH.LOGOUT);
      setUser(null);
      return { success: true };
    } catch (error) {
      // Even if API fails, clear local state - cookies may be cleared by browser
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
      linkGoogle,
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
      linkGoogle,
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
