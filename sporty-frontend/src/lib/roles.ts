/**
 * Mirrors the backend's UserRole enum (app/auth/models.py) and the tier
 * ordering used by require_admin_role (app/admin/dependencies.py).
 */
export type UserRole = "user" | "support" | "admin" | "super_admin";

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
};

function toUserRole(role: string | undefined | null): UserRole {
  return role === "support" || role === "admin" || role === "super_admin"
    ? role
    : "user";
}

/** True if `role` meets or exceeds `minRole` in the admin tier ordering. */
export function hasMinRole(
  role: string | undefined | null,
  minRole: UserRole,
): boolean {
  return ROLE_RANK[toUserRole(role)] >= ROLE_RANK[minRole];
}

/** True if `role` is any admin tier (support and above). */
export function isAdminRole(role: string | undefined | null): boolean {
  return hasMinRole(role, "support");
}
