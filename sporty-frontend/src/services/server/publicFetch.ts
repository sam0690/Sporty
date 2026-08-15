import "server-only";

/**
 * Server-side reads of the API's public (unauthenticated) endpoints.
 *
 * The Axios clients cannot be reused here: their baseURL is the relative
 * "/api/v1", which resolves in a browser but has no origin in Node. So this
 * builds an absolute URL against BACKEND_SERVER_URL — the same env var
 * next.config.ts rewrites to.
 *
 * Only ever call this for endpoints with no auth dependency. It sends no
 * cookies, and Next's fetch cache is shared across ALL visitors, so a
 * per-user response fetched here would be served to everyone.
 */
const BACKEND = process.env.BACKEND_SERVER_URL ?? "http://localhost:8000";

export async function publicFetch<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  revalidateSeconds = 60,
): Promise<T | null> {
  const url = new URL(`${BACKEND}/api/v1${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      // Shared across every visitor for this window, so N cold loads cost the
      // backend one query rather than N. Mirrors the Cache-Control the route
      // now sets (app/core/http_cache.py).
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // A prefetch is an optimisation, never a reason to fail the page — the
    // client will fetch it again on mount.
    return null;
  }
}
