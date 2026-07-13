import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/lib/route.config";

/**
 * Server-side route gating on auth-cookie PRESENCE (Next 16 "proxy" — the
 * renamed middleware convention).
 *
 * This is UX gating, not the security boundary — the API rejects invalid
 * tokens regardless. It stops protected shells from flashing for logged-out
 * visitors and bounces logged-in users off guest-only pages, before any
 * client JS runs.
 *
 * Requires same-origin cookies: dev gets them via the Next.js /api rewrite
 * proxy; production must set NEXT_PUBLIC_API_URL=/api/v1 on Vercel so the
 * browser talks to the API through the same proxy (cookies then live on the
 * app's own domain). With a direct cross-origin API base, no cookie is ever
 * visible here and this middleware would lock everyone out — hence the
 * fail-open shape: only redirect when we can SEE a session cookie state.
 */

const PROTECTED_PREFIXES = [
  ...new Set(
    Object.values(ROUTES)
      .filter((r) => r.protection === "protected" || r.protection === "admin")
      .map((r) => "/" + r.path.split("/")[1]),
  ),
];

const GUEST_ONLY_PATHS = Object.values(ROUTES)
  .filter((r) => r.protection === "guest-only")
  .map((r) => r.path);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // refresh_token outlives access_token (7d vs minutes) — its presence is the
  // real "has a session" signal; access_token alone covers the edge where a
  // refresh cookie was cleared server-side but an access token is still live.
  const hasSession =
    req.cookies.has("refresh_token") || req.cookies.has("access_token");

  if (
    !hasSession &&
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // "redirect" is the param the login flow already honors (via
    // getSafeRedirectPath) — see useLoginFormState / GuestOnlyRoute.
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && GUEST_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets, images, and the API proxy itself.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
