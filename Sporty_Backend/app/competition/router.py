"""Public competition pages API (real competitions: EPL / La Liga / Bundesliga).

Read-only, unauthenticated. Serves standings / scorers / matches per
competition + season from the cached snapshot layer (app/competition/service).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.competition import service
from app.database import get_db

router = APIRouter(prefix="/competitions", tags=["competitions"])


@router.get("")
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
        return {
            "competition": tag.upper(),
            "season": season or service.current_season(),
            "kind": kind,
            "data": payload,
        }

    return handler


router.add_api_route("/{tag}/standings", _snapshot("standings"), methods=["GET"])
router.add_api_route("/{tag}/scorers", _snapshot("scorers"), methods=["GET"])
router.add_api_route("/{tag}/matches", _snapshot("matches"), methods=["GET"])
