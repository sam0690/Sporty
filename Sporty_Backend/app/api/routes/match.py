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


async def _resolve_player_names(db, sporty_player_ids: set[str]) -> dict[str, str]:
    """Map feeder `sporty_player_id` values to display names.

    The feeder's id may correspond to our Player UUID or to Player.external_api_id,
    so match on both. Unmapped ids simply won't appear in the result and the
    caller falls back to showing the raw id.
    """
    ids = [pid for pid in sporty_player_ids if pid]
    if not ids:
        return {}
    rows = (
        await db.execute(
            text(
                """
                SELECT id::text AS id, external_api_id, name
                FROM players
                WHERE id::text = ANY(:ids) OR external_api_id = ANY(:ids)
                """
            ),
            {"ids": ids},
        )
    ).mappings().all()
    lookup: dict[str, str] = {}
    for row in rows:
        if row["id"]:
            lookup[row["id"]] = row["name"]
        if row["external_api_id"]:
            lookup[row["external_api_id"]] = row["name"]
    return lookup


@router.get("/match/{match_id}/ratings")
async def get_match_ratings(
    match_id: str,
    _match=Depends(require_match_access),
    db=Depends(get_async_db),
    redis=Depends(get_async_redis_dep),
):
    """Post-match player ratings pushed by the Sporty Data Feeder
    (cached 24h under ratings:match:{id}).

    Enriched server-side with player display names so the UI doesn't have to
    resolve raw feeder ids. `name` is added per rating (null when unmapped) and
    `man_of_match_name` alongside the existing MOTM id."""
    ratings = await _get_cached_match_json(redis, "ratings", _match)
    if ratings is None:
        raise HTTPException(status_code=404, detail="No ratings available for this match")

    entries = ratings.get("ratings") or []
    sporty_ids = {str(e["sporty_player_id"]) for e in entries if e.get("sporty_player_id")}
    motm_id = ratings.get("man_of_match_sporty_player_id")
    if motm_id:
        sporty_ids.add(str(motm_id))

    name_by_id = await _resolve_player_names(db, sporty_ids)

    for entry in entries:
        pid = entry.get("sporty_player_id")
        entry["name"] = name_by_id.get(str(pid)) if pid else None
    ratings["man_of_match_name"] = name_by_id.get(str(motm_id)) if motm_id else None

    return ratings
