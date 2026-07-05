/**
 * Centralized route configuration.
 *
 * Every navigable route in the application MUST be registered here.
 * Use the helpers in route.utils.ts to query route metadata at runtime —
 * NEVER hard-code route strings anywhere else.
 */

export type ProtectionLevel = "public" | "protected" | "guest-only" | "admin";

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
  RESET_PASSWORD: {
    path: "/reset-password",
    name: "Reset Password",
    protection: "public",
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
  ADMIN_DASHBOARD: {
    path: "/admin",
    name: "Admin",
    protection: "admin",
  },
  ADMIN_USERS: {
    path: "/admin/users",
    name: "Admin Users",
    protection: "admin",
  },
  ADMIN_LEAGUES: {
    path: "/admin/leagues",
    name: "Admin Leagues",
    protection: "admin",
  },
  ADMIN_AUDIT_LOG: {
    path: "/admin/audit-log",
    name: "Admin Audit Log",
    protection: "admin",
  },
  ADMIN_SCORING: {
    path: "/admin/scoring",
    name: "Admin Scoring",
    protection: "admin",
  },
  ADMIN_PLAYERS: {
    path: "/admin/players",
    name: "Admin Players",
    protection: "admin",
  },
  ADMIN_TRANSACTIONS: {
    path: "/admin/transactions",
    name: "Admin Transactions",
    protection: "admin",
  },
  ADMIN_JOBS: {
    path: "/admin/jobs",
    name: "Admin Jobs",
    protection: "admin",
  },
  ADMIN_CONFIG: {
    path: "/admin/config",
    name: "Admin Config",
    protection: "admin",
  },
} as const;
