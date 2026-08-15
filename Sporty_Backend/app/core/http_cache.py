"""Opt-out from the API's blanket `Cache-Control: no-store`.

SecurityHeadersMiddleware stamps `no-store, no-cache, must-revalidate` on every
API response *unless the route already set a Cache-Control of its own*
(app/middleware/security_headers.py). This is that opt-out, in one place, so the
rule for when it is safe is written down once instead of copy-pasted.

**Only ever apply this to a route with no auth dependency whose response is
identical for every caller.** `public` permits shared caches, so using it on
anything user-specific would let one user's data be served to another. If a
route takes `get_current_active_user`, `require_league_member`, or reads
`current_user`, it is not a candidate — leave it on `no-store`.

Note that both frontend Axios clients set `withCredentials: true` globally, so
these requests still arrive carrying a Cookie header. Browser caches honour
`public` regardless; a CDN, if one is ever put in front of the API, would need
to be configured to ignore/strip cookies on exactly these paths.

Usage — no change to the handler signature:

    @router.get("/fixtures", dependencies=[Depends(public_cache(60))])
"""
from __future__ import annotations

from fastapi import Response


def public_cache(max_age: int, stale_while_revalidate: int | None = None):
    """Build a dependency that marks the response publicly cacheable.

    Args:
        max_age: seconds a cache may serve the response without revalidating.
        stale_while_revalidate: extra seconds a cache may serve the stale copy
            while it refreshes in the background. Use for data with a slow,
            scheduled refresh (e.g. the 6h competition snapshots).
    """
    value = f"public, max-age={max_age}"
    if stale_while_revalidate is not None:
        value += f", stale-while-revalidate={stale_while_revalidate}"

    def _apply(response: Response) -> None:
        response.headers["Cache-Control"] = value

    return _apply
