/**
 * Centralized route configuration.
 *
 * Every navigable route in the application MUST be registered here.
 * Use the helpers in route.utils.ts to query route metadata at runtime —
 * NEVER hard-code route strings anywhere else.
 */

export type ProtectionLevel = "public" | "protected" | "guest-only";

export interface RouteMeta {
  /** URL path (must match the Next.js file-system route) */
  path: string;
  /** Human-readable name shown in nav / breadcrumbs */
  name: string;
  /** Access control level */
  protection: ProtectionLevel;
}

export const ROUTES: Record<string, RouteMeta> = {
  HOME: {
    path: "/",
    name: "Home",
    protection: "public",
  },
  LOGIN: {
    path: "/login",
    name: "Login",
    protection: "guest-only",
  },
  REGISTER: {
    path: "/register",
    name: "Register",
    protection: "guest-only",
  },
  DASHBOARD: {
    path: "/dashboard",
    name: "Dashboard",
    protection: "protected",
  },
  PROFILE: {
    path: "/profile",
    name: "Profile",
    protection: "protected",
  },
  SETTINGS: {
    path: "/settings",
    name: "Settings",
    protection: "protected",
  },
  USER_PROFILE: {
    path: "/user/:id",
    name: "User Profile",
    protection: "protected",
  },
} as const;
