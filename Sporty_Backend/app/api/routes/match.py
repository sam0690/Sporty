from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text

from app.api.deps import (
    get_async_db,
    get_async_redis_dep,
    require_match_access,
)
from app.match.router import MATCH_TEAM_NAME_ALIASES
from app.player.models import Player

router = APIRouter(tags=["Realtime"])


async def _resolve_team_logo_urls(
    db, sport_id: str | None, home_team: str | None, away_team: str | None
) -> tuple[str | None, str | None]:
    """Same name+sport lookup (with the same alias map) as the REST /matches
    list — kept as a single shared alias table so both surfaces agree on
    which fixture strings map to which RealTeam row."""
    if not sport_id or not (home_team or away_team):
        return None, None

    canonical_home = MATCH_TEAM_NAME_ALIASES.get(home_team, home_team) if home_team else None
    canonical_away = MATCH_TEAM_NAME_ALIASES.get(away_team, away_team) if away_team else None
    names = [n for n in (canonical_home, canonical_away) if n]
    if not names:
        return None, None

    rows = (
        await db.execute(
            text(
                "SELECT name, logo_url FROM real_teams WHERE sport_id = :sport_id AND name = ANY(:names)"
            ),
            {"sport_id": sport_id, "names": names},
        )
    ).mappings().all()
    logo_by_name = {r["name"]: r["logo_url"] for r in rows}
    return (
        logo_by_name.get(canonical_home) if canonical_home else None,
        logo_by_name.get(canonical_away) if canonical_away else None,
    )


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


async def _get_persisted_match_json(db, kind: str, match_id) -> dict | None:
    """Durable backstop once the 24h Redis cache entry for a feeder push
    (prediction/ratings/lineups) has expired — see match_feed_cache."""
    row = (
        await db.execute(
            text("SELECT payload FROM match_feed_cache WHERE match_id = :match_id AND kind = :kind"),
            {"match_id": str(match_id), "kind": kind},
        )
    ).mappings().first()
    return row["payload"] if row else None


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
                SELECT id::text AS id, sport_id::text AS sport_id, home_team, away_team,
                       home_score, away_score, status, match_date
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
    lineup_data = None
    if lineups_raw:
        try:
            lineup_data = json.loads(lineups_raw)
        except (ValueError, TypeError):
            lineup_data = None
    if lineup_data is None:
        lineup_data = await _get_persisted_match_json(db, "lineups", row["id"])
    if lineup_data:
        lineup_home = [str(x) for x in (lineup_data.get("home") or [])]
        lineup_away = [str(x) for x in (lineup_data.get("away") or [])]

    # Pre-parse each row's meta once — substitutions carry the outgoing
    # player's id here (see feed.py's ingest_match_result), which needs to
    # join the name-resolution batch below alongside every other player id.
    event_metas = [e["meta"] if isinstance(e["meta"], dict) else {} for e in event_rows]

    # Resolve every player UUID seen (events + point hashes + lineups) to a name.
    player_ids = {e["player_id"] for e in event_rows if e["player_id"]}
    player_ids |= {meta.get("related_player_id") for meta in event_metas if meta.get("related_player_id")}
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
    for e, meta in zip(event_rows, event_metas):
        pid = e["player_id"] or None
        info = players.get(pid) if pid else None
        related_pid = meta.get("related_player_id")
        related_info = players.get(related_pid) if related_pid else None
        events.append(
            {
                "event_id": e["event_id"],
                "type": e["event_type"],
                "minute": meta.get("minute"),
                "player_id": pid,
                "player_name": info["name"] if info else None,
                "team": info["team"] if info else None,
                "related_player_id": related_pid,
                "related_player_name": related_info["name"] if related_info else None,
                "related_team": related_info["team"] if related_info else None,
            }
        )

    home_team_logo_url, away_team_logo_url = await _resolve_team_logo_urls(
        db, row["sport_id"], row["home_team"], row["away_team"]
    )

    return {
        "match_id": row["id"],
        "home_team": row["home_team"],
        "away_team": row["away_team"],
        "home_team_logo_url": home_team_logo_url,
        "away_team_logo_url": away_team_logo_url,
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
    redis=Depends(get_async_redis_dep),
):
    """Global model-performance scorecard pushed by the Sporty Data Feeder
    (accuracy/log-loss of its stored predictions vs actual results, per model
    version; cached under model:metrics). Public, like the rest of the match
    detail surface — aggregate, non-sensitive data."""
    cached = await redis.get("model:metrics")
    if cached is None:
        raise HTTPException(status_code=404, detail="No model metrics available")
    return json.loads(cached)


@router.get("/match/{match_id}/prediction")
async def get_match_prediction(
    match_id: str,
    _match=Depends(require_match_access),
    db=Depends(get_async_db),
    redis=Depends(get_async_redis_dep),
):
    """Pre-match outcome probabilities pushed by the Sporty Data Feeder
    (cached 24h under prediction:match:{id}, falling back to the durable
    match_feed_cache backstop once that entry expires)."""
    prediction = await _get_cached_match_json(redis, "prediction", _match)
    if prediction is None:
        prediction = await _get_persisted_match_json(db, "prediction", _match.id)
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
    `man_of_match_name` alongside the existing MOTM id. Falls back to the
    durable match_feed_cache backstop once the 24h Redis entry expires."""
    ratings = await _get_cached_match_json(redis, "ratings", _match)
    if ratings is None:
        ratings = await _get_persisted_match_json(db, "ratings", _match.id)
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
