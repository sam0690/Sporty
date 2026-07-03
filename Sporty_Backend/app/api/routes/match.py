from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text

from app.api.deps import (
    get_async_db,
    get_async_redis_dep,
    get_current_active_user_async,
    require_match_access,
)
from app.player.models import Player

router = APIRouter(tags=["Realtime"])


async def _resolve_players(db, player_ids: set[str]) -> dict[str, dict]:
    """Map Sporty player ids to display info (name/position/team).

    A feeder id may be our Player.id (UUID) OR the player's external_api_id, so
    match on both — mirroring _resolve_player_names used by the ratings route.
    The result is keyed by BOTH the canonical id and the external id (plus the
    exact id string the caller passed) so lookups succeed regardless of which
    form the events / point hashes used. Unknown ids are omitted so callers can
    fall back to a friendly label.
    """
    ids = [pid for pid in player_ids if pid]
    if not ids:
        return {}
    # id comparison is case-insensitive (feeder point-hash keys arrive uppercase
    # while Player.id renders lowercase); external_api_id is matched verbatim.
    lowered = list({pid.lower() for pid in ids})
    rows = (
        await db.execute(
            text(
                """
                SELECT id::text AS id, external_api_id, name, position, real_team
                FROM players
                WHERE lower(id::text) = ANY(:lowered) OR external_api_id = ANY(:ids)
                """
            ),
            {"lowered": lowered, "ids": ids},
        )
    ).mappings().all()

    by_lower_id: dict[str, dict] = {}
    by_ext: dict[str, dict] = {}
    for r in rows:
        info = {"name": r["name"], "position": r["position"], "team": r["real_team"]}
        if r["id"]:
            by_lower_id[r["id"].lower()] = info
        if r["external_api_id"]:
            by_ext[r["external_api_id"]] = info

    # Key by the exact id string the caller passed so lookups succeed whatever
    # case/form the events, point hashes, or lineups used.
    resolved: dict[str, dict] = {}
    for pid in ids:
        info = by_lower_id.get(pid.lower()) or by_ext.get(pid)
        if info:
            resolved[pid] = info
    return resolved


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

    # Match event timeline (goals/cards/assists/etc.) from the stored live feed,
    # ordered by minute. Used to render a human-readable feed instead of UUIDs.
    event_rows = (
        await db.execute(
            text(
                """
                SELECT event_id, event_type, player_id, team_id, meta
                FROM live_events
                WHERE match_id = :match_id
                ORDER BY COALESCE((meta->>'minute')::int, 0), ts
                """
            ),
            {"match_id": live_key},
        )
    ).mappings().all()

    # Starting lineups (who's playing, per team) — pushed by the feeder and
    # cached in Redis under the match UUID.
    lineup_home: list[str] = []
    lineup_away: list[str] = []
    lineups_raw = await redis.get(f"lineups:match:{row['id']}")
    if lineups_raw:
        try:
            lineup_data = json.loads(lineups_raw)
            lineup_home = [str(x) for x in (lineup_data.get("home") or [])]
            lineup_away = [str(x) for x in (lineup_data.get("away") or [])]
        except (ValueError, TypeError):
            pass

    # Resolve every player UUID seen (events + point hashes + lineups) to a name.
    player_ids = {e["player_id"] for e in event_rows if e["player_id"]}
    player_ids |= set(points.keys())
    player_ids |= set(lineup_home) | set(lineup_away)
    players = await _resolve_players(db, player_ids)

    def _lineup_entry(pid: str) -> dict:
        info = players.get(pid)
        return {
            "player_id": pid,
            "name": info["name"] if info else None,
            "position": info["position"] if info else None,
            "team": info["team"] if info else None,
        }

    events = []
    for e in event_rows:
        pid = e["player_id"] or None
        info = players.get(pid) if pid else None
        meta = e["meta"] if isinstance(e["meta"], dict) else {}
        events.append(
            {
                "event_id": e["event_id"],
                "type": e["event_type"],
                "minute": meta.get("minute"),
                "player_id": pid,
                "player_name": info["name"] if info else None,
                "team": info["team"] if info else None,
            }
        )

    return {
        "match_id": row["id"],
        "home_team": row["home_team"],
        "away_team": row["away_team"],
        "score": {
            "home": int(row["home_score"] or 0),
            "away": int(row["away_score"] or 0),
        },
        "status": row["status"],
        "match_date": row["match_date"].isoformat() if row["match_date"] else None,
        "players": players,
        "events": events,
        "player_points": points,
        "lineups": {
            "home": [_lineup_entry(pid) for pid in lineup_home],
            "away": [_lineup_entry(pid) for pid in lineup_away],
        },
    }


@router.get("/model-metrics")
async def get_model_metrics(
    _user=Depends(get_current_active_user_async),
    redis=Depends(get_async_redis_dep),
):
    """Global model-performance scorecard pushed by the Sporty Data Feeder
    (accuracy/log-loss of its stored predictions vs actual results, per model
    version; cached under model:metrics). Not match-scoped: any signed-in user
    may read it."""
    cached = await redis.get("model:metrics")
    if cached is None:
        raise HTTPException(status_code=404, detail="No model metrics available")
    return json.loads(cached)


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
