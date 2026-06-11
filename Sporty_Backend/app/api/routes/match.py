from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.api.deps import (
    get_async_db,
    get_async_redis_dep,
    require_match_access,
)

router = APIRouter(tags=["Realtime"])


async def _get_cached_match_json(redis, prefix: str, _match) -> dict | None:
    """Feed caches are keyed by sporty_match_id, which may be the match UUID
    or its external_api_id — try both, mirroring /match/{id}/state."""
    for key in (f"{prefix}:match:{_match.id}", f"{prefix}:match:{_match.external_api_id}"):
        raw = await redis.get(key)
        if raw:
            try:
                return json.loads(raw)
            except (TypeError, ValueError):
                continue
    return None


@router.get("/match/{match_id}/state")
async def get_match_state(
    match_id: str,
    _match=Depends(require_match_access),
    db=Depends(get_async_db),
    redis=Depends(get_async_redis_dep),
):
    live_key = _match.external_api_id or str(_match.id)
    row = (
        await db.execute(
            text(
                """
                SELECT id::text AS id, home_team, away_team, home_score, away_score, status, match_date
                FROM matches
                WHERE id::text = :match_id OR external_api_id = :match_id
                LIMIT 1
                """
            ),
            {"match_id": match_id},
        )
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Match not found")

    points: dict[str, float] = {}
    point_key_patterns = [
        f"fantasy:match:{live_key}:player:*",
        f"fantasy:match:{row['id']}:player:*",
    ]
    for pattern in point_key_patterns:
        keys = await redis.keys(pattern)
        for key in keys:
            player_id = key.rsplit(":", 1)[-1]
            value = await redis.hget(key, "points")
            if value is None:
                continue
            points[player_id] = float(value)

    return {
        "match_id": row["id"],
        "score": {
            "home": int(row["home_score"] or 0),
            "away": int(row["away_score"] or 0),
        },
        "status": row["status"],
        "match_date": row["match_date"].isoformat() if row["match_date"] else None,
        "lineups": {},
        "player_points": points,
    }


@router.get("/match/{match_id}/prediction")
async def get_match_prediction(
    match_id: str,
    _match=Depends(require_match_access),
    redis=Depends(get_async_redis_dep),
):
    """Pre-match outcome probabilities pushed by the Sporty Data Feeder
    (cached 24h under prediction:match:{id})."""
    prediction = await _get_cached_match_json(redis, "prediction", _match)
    if prediction is None:
        raise HTTPException(status_code=404, detail="No prediction available for this match")
    return prediction


@router.get("/match/{match_id}/ratings")
async def get_match_ratings(
    match_id: str,
    _match=Depends(require_match_access),
    redis=Depends(get_async_redis_dep),
):
    """Post-match player ratings pushed by the Sporty Data Feeder
    (cached 24h under ratings:match:{id})."""
    ratings = await _get_cached_match_json(redis, "ratings", _match)
    if ratings is None:
        raise HTTPException(status_code=404, detail="No ratings available for this match")
    return ratings
