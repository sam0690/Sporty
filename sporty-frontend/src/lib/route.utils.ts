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
 * Whether a nav item's href should render as "active" for the current path:
 * an exact match, or the current path is nested under it.
 */
export function isActiveRoute(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Validate a `redirect` query param before navigating to it.
 *
 * Only same-origin relative paths are allowed (must start with a single "/",
 * never "//" or a path containing "://") to prevent open-redirect attacks
 * via a crafted login/signup link.
 */
/**
 * URL for the one-time post-signup "pick your favourites" step, carrying the
 * user's original destination through as a `redirect` query param.
 */
export function buildFavouritesOnboardingUrl(redirect: string | null): string {
  const base = ROUTES.ONBOARDING_FAVOURITES.path;
  return redirect ? `${base}?redirect=${encodeURIComponent(redirect)}` : base;
}

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
