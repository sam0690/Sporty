import { ROUTES, type RouteMeta } from "./route.config";

/**
 * Look up route metadata by its URL path.
 * Returns `undefined` when no route matches the given path.
 */
export function getRouteMetaByPath(pathname: string): RouteMeta | undefined {
  return Object.values(ROUTES).find((route) => route.path === pathname);
}

/**
 * Check whether a given path requires authentication.
 */
export function isProtectedRoute(pathname: string): boolean {
  const meta = getRouteMetaByPath(pathname);
  return meta?.protection === "protected";
}

/**
 * Check whether a given path is guest-only (e.g. login, register).
 */
export function isGuestOnlyRoute(pathname: string): boolean {
  const meta = getRouteMetaByPath(pathname);
  return meta?.protection === "guest-only";
}

/**
 * Check whether a given path requires an admin role (support/admin/super_admin).
 */
export function isAdminRoute(pathname: string): boolean {
  const meta = getRouteMetaByPath(pathname);
  return meta?.protection === "admin";
}

/**
 * Validate a `redirect` query param before navigating to it.
 *
 * Only same-origin relative paths are allowed (must start with a single "/",
 * never "//" or a path containing "://") to prevent open-redirect attacks
 * via a crafted login/signup link.
 */
export function getSafeRedirectPath(
  redirect: string | null | undefined,
): string | null {
  if (!redirect) {
    return null;
  }
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return null;
  }
  if (redirect.includes("://")) {
    return null;
  }
  return redirect;
}
