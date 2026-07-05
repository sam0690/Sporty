"""Real-API live NBA polling — off by default (settings.LIVE_POLLING_ENABLED).

Mirrors the SportyDataFeeder push path the same way football_live_sync.py
does (see that module's docstring for the shared design). One NBA-specific
wrinkle: API-NBA's /players/statistics returns *cumulative* per-game box
score numbers, not discrete events, so each poll diffs against the previous
poll's numbers (cached in Redis) and re-expresses the delta as synthetic
discrete events (goal-equivalent "point_2"/"point_3"/"free_throw", "assist",
"rebound", "steal", "block") so the existing apply_live_points/
persist_match_stats machinery — built for discrete events — can be reused
unchanged. The exact shot-type split (2s vs 3s) is a greedy reconstruction
from the points delta, not the real shot log; only the total matters for
scoring, since the fantasy formula weights total points, not shot type.

Player identity gotcha: the basketball roster catalog (sync_basketball_players,
via the official nba_api package/stats.nba.com) and this live feed (API-NBA
via RapidAPI) are different providers with unrelated player-id namespaces, so
Player.external_api_id (an nba_api id) cannot be matched against API-NBA's
player id. Players are matched by folded name + team instead.
"""

from __future__ import annotations

import json
import logging
import unicodedata
from datetime import datetime, timezone

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.admin.feature_flags import get_effective_flag
from app.core.config import settings
from app.core.redis import get_async_redis
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.schemas.events import WSMessage
from app.player.models import Player
from app.services.feed_scoring import LiveEventLike, apply_live_points, persist_match_stats
from app.services.scoring.trigger import enqueue_scoring_for_finished_match

logger = logging.getLogger(__name__)

_RAW_STATS_TTL_SECONDS = 6 * 3600
_STAT_FIELDS = ("points", "assists", "totReb", "steals", "blocks")


def _fold_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.lower().split())


async def _get(client: httpx.AsyncClient, path: str, params: dict) -> dict:
    response = await client.get(
        f"https://{settings.RAPIDAPI_NBA_HOST}{path}",
        headers={
            "X-RapidAPI-Key": settings.RAPIDAPI_NBA_KEY,
            "X-RapidAPI-Host": settings.RAPIDAPI_NBA_HOST,
        },
        params=params,
        timeout=15.0,
    )
    response.raise_for_status()
    return response.json()


def _is_live(status_obj: dict) -> bool:
    long_status = str(status_obj.get("long", "")).lower()
    short_status = str(status_obj.get("short", "")).lower()
    return "live" in long_status or "in play" in long_status or short_status in {
        "q1", "q2", "q3", "q4", "ot", "ht",
    }


def _is_finished(status_obj: dict) -> bool:
    return "finished" in str(status_obj.get("long", "")).lower()


def _decompose_points(delta: int) -> list[str]:
    """Greedy reconstruction of a points delta into scoring events. Only the
    total matters (see module docstring) — the 2/3/FT split is not the real
    shot log."""
    events: list[str] = []
    remaining = max(delta, 0)
    while remaining >= 3:
        events.append("point_3")
        remaining -= 3
    while remaining >= 2:
        events.append("point_2")
        remaining -= 2
    while remaining >= 1:
        events.append("free_throw")
        remaining -= 1
    return events


async def sync_nba_live_matches(db: Session, season: int = 2024) -> str:
    if not get_effective_flag(db, "live_polling_enabled", default=settings.LIVE_POLLING_ENABLED):
        return "ok: live polling disabled (LIVE_POLLING_ENABLED=false); using simulator"

    if not settings.RAPIDAPI_NBA_KEY:
        return "ok: RAPIDAPI_NBA_KEY not configured"

    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        return "ok: basketball sport not seeded"

    async with httpx.AsyncClient() as client:
        try:
            games_payload = await _get(client, "/games", {"league": "standard", "season": season, "live": "all"})
        except Exception:
            logger.exception("NBA live poll: live games request failed")
            return "error: live games request failed"

        live_games = games_payload.get("response", [])
        if not isinstance(live_games, list) or not live_games:
            return "ok: no live NBA games"

        redis = await get_async_redis()
        updated = 0

        # Name -> Player, scoped to basketball, for folded-name matching.
        by_name: dict[str, list[Player]] = {}
        for player in db.query(Player).filter(Player.sport_id == sport.id).all():
            by_name.setdefault(_fold_name(player.name), []).append(player)

        for game in live_games:
            game_id = str(game.get("id") or "")
            status_obj = game.get("status", {}) if isinstance(game.get("status"), dict) else {}
            if not game_id or not (_is_live(status_obj) or _is_finished(status_obj)):
                continue

            match = (
                db.query(Match)
                .filter(Match.sport_id == sport.id, Match.external_api_id == game_id)
                .first()
            )
            if match is None:
                continue

            finished_now = _is_finished(status_obj) and match.status != "finished"
            new_status = "finished" if _is_finished(status_obj) else "live"
            minute = status_obj.get("clock")
            scores_obj = game.get("scores", {}) if isinstance(game.get("scores"), dict) else {}

            try:
                stats_payload = await _get(client, "/players/statistics", {"game": game_id})
            except Exception:
                logger.exception("NBA live poll: box score request failed for game %s", game_id)
                stats_payload = {}
            stat_rows = stats_payload.get("response", [])
            if not isinstance(stat_rows, list):
                stat_rows = []

            live_key = match.external_api_id or str(match.id)
            now = datetime.now(timezone.utc)
            rows: list[dict] = []
            scorable_events: list[LiveEventLike] = []

            for row in stat_rows:
                player_obj = row.get("player", {}) if isinstance(row.get("player"), dict) else {}
                team_obj = row.get("team", {}) if isinstance(row.get("team"), dict) else {}
                full_name = f"{player_obj.get('firstname', '')} {player_obj.get('lastname', '')}".strip()
                if not full_name:
                    continue

                candidates = by_name.get(_fold_name(full_name), [])
                if not candidates:
                    continue
                sporty_player = candidates[0]
                if len(candidates) > 1 and team_obj.get("name"):
                    wanted = _fold_name(str(team_obj.get("name")))
                    for candidate in candidates:
                        have = _fold_name(candidate.real_team or "")
                        if have and (have == wanted or wanted in have or have in wanted):
                            sporty_player = candidate
                            break

                raw_cache_key = f"nba:live:raw:{game_id}:{sporty_player.id}"
                previous_raw = await redis.get(raw_cache_key)
                previous = json.loads(previous_raw) if previous_raw else {field: 0 for field in _STAT_FIELDS}

                current = {field: _coerce_int(row.get(field)) for field in _STAT_FIELDS}
                deltas = {field: max(current[field] - previous.get(field, 0), 0) for field in _STAT_FIELDS}
                await redis.set(raw_cache_key, json.dumps(current), ex=_RAW_STATS_TTL_SECONDS)

                event_types: list[str] = []
                event_types += _decompose_points(deltas["points"])
                event_types += ["assist"] * deltas["assists"]
                event_types += ["rebound"] * deltas["totReb"]
                event_types += ["steal"] * deltas["steals"]
                event_types += ["block"] * deltas["blocks"]

                for index, event_type in enumerate(event_types):
                    event_id = f"{game_id}:{sporty_player.id}:{int(now.timestamp())}:{event_type}:{index}"
                    rows.append({
                        "match_id": live_key,
                        "event_id": event_id,
                        "sport": "basketball",
                        "event_type": event_type,
                        "player_id": str(sporty_player.id),
                        "team_id": str(team_obj.get("id") or ""),
                        "value": 0.0,
                        "meta": {"minute": minute, "source": "api-nba"},
                        "ts": now,
                    })
                    scorable_events.append(LiveEventLike(str(sporty_player.id), event_type))

            if rows:
                statement = (
                    pg_insert(LiveEvent)
                    .values(rows)
                    .on_conflict_do_nothing(index_elements=["match_id", "event_id"])
                )
                db.execute(statement)

            match.home_score = _coerce_int((scores_obj.get("home") or {}).get("points"))
            match.away_score = _coerce_int((scores_obj.get("visitors") or {}).get("points"))
            match.status = new_status
            db.commit()
            updated += 1

            channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
            message = WSMessage(
                event="SCORE_UPDATE",
                data={
                    "kind": "LIVE_API_POLL",
                    "match_id": live_key,
                    "sport": "basketball",
                    "status": new_status,
                    "home": match.home_score,
                    "away": match.away_score,
                    "minute": minute,
                },
            )
            await redis.publish(channel, message.model_dump_json())
            if scorable_events:
                await apply_live_points(
                    redis, live_key=live_key, sport="basketball", events=scorable_events, channel=channel
                )

            if finished_now:
                persist_match_stats(db, match=match, live_key=live_key, sport="basketball")
                db.commit()
                try:
                    enqueue_scoring_for_finished_match(
                        db, match_date=match.match_date, sport_id=match.sport_id
                    )
                except Exception:
                    logger.exception(
                        "NBA live poll: finish %s stats booked but scoring enqueue failed", live_key
                    )

    return f"ok: polled {len(live_games)} live game(s), updated {updated}"


def _coerce_int(value, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default
