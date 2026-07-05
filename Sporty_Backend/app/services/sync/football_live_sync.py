"""Real-API live football polling — off by default (settings.LIVE_POLLING_ENABLED).

Mirrors the SportyDataFeeder push path (app/api/v1/feed.py's /match-result)
but pulls from API-Football instead of receiving a push: upserts LiveEvent
rows, updates Match score/status, publishes SCORE_UPDATE to the same Redis
channel the WebSocket routes subscribe to, applies live fantasy-point deltas,
and on the live->finished transition books gameweek stats and enqueues
scoring — so a real match would show up identically to a simulated one.

Only matches with a numeric (real, API-Football-sourced) external_api_id are
touched; feeder-simulated matches (external_api_id = "feeder:<uuid>") are
never matched by a fixture-id lookup here, so the two live-data sources never
collide over the same Match row.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.admin.feature_flags import get_effective_flag
from app.core.config import settings
from app.core.redis import get_async_redis
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.schemas.events import WSMessage
from app.player.models import Player
from app.services.feed_scoring import LiveEventLike, apply_live_points, persist_match_stats
from app.services.scoring.trigger import enqueue_scoring_for_finished_match

logger = logging.getLogger(__name__)

_STATUS_MAP = {
    "NS": "scheduled",
    "1H": "live", "HT": "live", "2H": "live", "ET": "live", "P": "live",
    "FT": "finished", "AET": "finished", "PEN": "finished",
    "PST": "postponed", "CANC": "cancelled", "ABD": "cancelled",
    "AWD": "finished", "WO": "finished",
}

# (type, detail) as returned by API-Football's /fixtures/events, lower-cased.
# Own goals and missed penalties intentionally map to None (skipped): an own
# goal's scorer is on the conceding team and shouldn't be credited a goal.
_EVENT_TYPE_MAP: dict[tuple[str, str], str] = {
    ("goal", "normal goal"): "goal",
    ("goal", "penalty"): "goal",
    ("card", "yellow card"): "yellow_card",
    ("card", "red card"): "red_card",
    ("card", "second yellow card"): "red_card",
}


def _map_event_type(event_type: str, detail: str) -> str | None:
    return _EVENT_TYPE_MAP.get((event_type.strip().lower(), detail.strip().lower()))


async def sync_football_live_matches(db: Session) -> str:
    if not get_effective_flag(db, "live_polling_enabled", default=settings.LIVE_POLLING_ENABLED):
        return "ok: live polling disabled (LIVE_POLLING_ENABLED=false); using simulator"

    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        return "ok: football sport not seeded"

    client = FootballAPIClient()
    try:
        payload = await client.get_live_fixtures(league_id=settings.FOOTBALL_LIVE_LEAGUE_ID)
    except Exception:
        logger.exception("Football live poll: live fixtures request failed")
        return "error: live fixtures request failed"

    fixtures = payload.get("response", [])
    if not fixtures:
        return "ok: no live football fixtures"

    redis = await get_async_redis()
    updated = 0

    for fixture_data in fixtures:
        fixture = fixture_data.get("fixture", {}) or {}
        goals = fixture_data.get("goals", {}) or {}
        fixture_id = fixture.get("id")
        if fixture_id is None:
            continue

        match = (
            db.query(Match)
            .filter(Match.sport_id == sport.id, Match.external_api_id == str(fixture_id))
            .first()
        )
        if match is None:
            # Not a fixture the hourly sync has registered yet — skip; it'll
            # be picked up once sync.football.matches creates the row.
            continue

        status_obj = fixture.get("status", {}) or {}
        new_status = _STATUS_MAP.get(status_obj.get("short", "NS"), "scheduled")
        finished_now = new_status == "finished" and match.status != "finished"
        minute = status_obj.get("elapsed") or 0

        try:
            events_payload = await client.get_match_events(fixture_id=fixture_id)
        except Exception:
            logger.exception("Football live poll: events request failed for fixture %s", fixture_id)
            events_payload = {}
        raw_events = events_payload.get("response", [])

        live_key = match.external_api_id or str(match.id)
        now = datetime.now(timezone.utc)
        rows: list[dict] = []
        scorable_events: list[LiveEventLike] = []

        for raw in raw_events:
            player = raw.get("player", {}) or {}
            team = raw.get("team", {}) or {}
            api_player_id = player.get("id")
            if api_player_id is None:
                continue

            sporty_player = (
                db.query(Player)
                .filter(Player.sport_id == sport.id, Player.external_api_id == str(api_player_id))
                .first()
            )
            if sporty_player is None:
                continue  # not a player we know about (not drafted/synced)

            event_minute = (raw.get("time") or {}).get("elapsed", 0)
            api_type = str(raw.get("type", ""))
            detail = str(raw.get("detail", ""))
            event_id = f"{fixture_id}:{event_minute}:{api_type}:{api_player_id}:{detail}"
            mapped_type = _map_event_type(api_type, detail)

            rows.append({
                "match_id": live_key,
                "event_id": event_id,
                "sport": "football",
                "event_type": mapped_type or api_type.lower(),
                "player_id": str(sporty_player.id),
                "team_id": str(team.get("id") or ""),
                "value": 0.0,
                "meta": {"minute": event_minute, "detail": detail, "source": "api-football"},
                "ts": now,
            })
            if mapped_type:
                scorable_events.append(LiveEventLike(str(sporty_player.id), mapped_type))

        if rows:
            statement = (
                pg_insert(LiveEvent)
                .values(rows)
                .on_conflict_do_nothing(index_elements=["match_id", "event_id"])
            )
            db.execute(statement)

        match.home_score = goals.get("home")
        match.away_score = goals.get("away")
        match.status = new_status
        db.commit()
        updated += 1

        channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
        message = WSMessage(
            event="SCORE_UPDATE",
            data={
                "kind": "LIVE_API_POLL",
                "match_id": live_key,
                "sport": "football",
                "status": new_status,
                "home": match.home_score,
                "away": match.away_score,
                "minute": minute,
            },
        )
        await redis.publish(channel, message.model_dump_json())
        if scorable_events:
            await apply_live_points(
                redis, live_key=live_key, sport="football", events=scorable_events, channel=channel
            )

        if finished_now:
            persist_match_stats(db, match=match, live_key=live_key, sport="football")
            db.commit()
            try:
                enqueue_scoring_for_finished_match(
                    db, match_date=match.match_date, sport_id=match.sport_id
                )
            except Exception:
                logger.exception(
                    "Football live poll: finish %s stats booked but scoring enqueue failed", live_key
                )

    return f"ok: polled {len(fixtures)} live fixture(s), updated {updated}"
