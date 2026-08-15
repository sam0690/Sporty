"""Public competition pages API (real competitions: EPL / La Liga / Bundesliga).

Read-only, unauthenticated. Serves standings / scorers / matches per
competition + season from the cached snapshot layer (app/competition/service).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.competition import service
from app.core.http_cache import public_cache
from app.database import get_db

router = APIRouter(prefix="/competitions", tags=["competitions"])

# Every route here is unauthenticated and identical for all callers, and the
# underlying snapshots refresh on a 6h TTL — so a shared cache is safe and the
# stale window is generous.
_CACHE = [Depends(public_cache(300, stale_while_revalidate=600))]


@router.get("", dependencies=_CACHE)
def list_competitions():
    """Tracked competitions + the season window available on the data source."""
    return {
        "competitions": service.list_competitions(),
        "seasons": service.available_seasons(),
        "current_season": service.current_season(),
    }


def _snapshot(kind: str):
    async def handler(tag: str, season: int | None = None, db=Depends(get_db)):
        try:
            payload = await service.get_snapshot(db, tag.upper(), kind, season)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        # Report the season actually served — for a current-view request the
        # competition resolves its own (CL differs from the domestic leagues).
        actual = season or service.resolved_season(payload) or service.current_season()
        return {
            "competition": tag.upper(),
            "season": actual,
            "kind": kind,
            "data": payload,
        }

    return handler


router.add_api_route("/{tag}/standings", _snapshot("standings"), methods=["GET"], dependencies=_CACHE)
router.add_api_route("/{tag}/scorers", _snapshot("scorers"), methods=["GET"], dependencies=_CACHE)
router.add_api_route("/{tag}/matches", _snapshot("matches"), methods=["GET"], dependencies=_CACHE)


@router.get("/{tag}/matches/{match_id}", dependencies=_CACHE)
def get_competition_match(tag: str, match_id: str, db=Depends(get_db)):
    """Detail for a single display-only competition match (from the snapshot).
    football-data.org's free tier has no events/lineups, so this is the match
    card data: teams, score, stage, matchday, date, status."""
    match = service.get_match(db, tag.upper(), match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return {"competition": tag.upper(), "match": match}
