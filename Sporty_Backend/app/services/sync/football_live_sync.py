"""Real-API live football polling — off by default (settings.LIVE_POLLING_ENABLED).

Mirrors the SportyDataFeeder push path (app/api/v1/feed.py's /match-result)
but pulls from API-Football instead of receiving a push: upserts LiveEvent
rows, updates Match score/status, publishes SCORE_UPDATE to the same Redis
channel the WebSocket routes subscribe to, applies live fantasy-point deltas,
and on the live->finished transition books gameweek stats and enqueues
scoring — so a real match would show up identically to a simulated one.

Quota discipline (free tier = 100 req/day, budget = FOOTBALL_API_DAILY_BUDGET):
the poll makes ZERO API calls unless a fixture with a numeric external id is
inside a live window (kickoff-5min .. kickoff+3h, or already status='live')
or awaiting a missed final; each live poll is ONE request because live
fixtures embed their events; FootballQuotaExhausted pauses everything for
the rest of the UTC day.

The Beat cadence is coarse (every 6h, user decision) so most matches start
and finish between ticks; the reconcile pass fetches those finals via the
Free-plan-allowed fixtures?date= query and books their FT stat sheets, so
scores/fantasy points arrive hours late but never go missing.

Only matches with a numeric (real, API-Football-sourced) external_api_id are
touched; feeder-simulated matches (external_api_id = "feeder:<uuid>") are
never matched by a fixture-id lookup here, so the two live-data sources never
collide over the same Match row.

sync_football_predictions lives here too: once per matchday it fetches the
API-Football pre-match prediction for each upcoming fixture and caches it
under the same Redis keys + MatchFeedCache rows the feeder's /feed/prediction
push used, so the frontend read path is unchanged.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.admin.feature_flags import get_effective_flag
from app.core.config import settings
from app.core.redis import LIVE_FAVOURITES_CACHE_KEY, cache_delete, get_async_redis
from app.external_apis.football_api import FootballAPIClient, FootballQuotaExhausted
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.schemas.events import WSMessage
from app.player.models import Player
from app.services.feed_scoring import (
    LiveEventLike,
    apply_live_points,
    persist_football_stats_from_sheet,
    persist_match_stats,
)
from app.services.sync.football_competitions import fantasy_competitions
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

# How long after kickoff a fixture can still be live (90' + stoppage + HT +
# ET/pens headroom).
_LIVE_WINDOW_AFTER_KICKOFF = timedelta(hours=3)


def _map_event_type(event_type: str, detail: str) -> str | None:
    return _EVENT_TYPE_MAP.get((event_type.strip().lower(), detail.strip().lower()))


def _parse_player_sheet(payload: dict, fixture_data: dict, resolve_player) -> dict:
    """API-Football /fixtures/players response -> {sporty_player_uuid: sheet}
    in the shape persist_football_stats_from_sheet books.

    clean_sheets is derived (not in the API sheet): 1 if the player's team
    conceded 0 and they played >= 60 minutes (FPL convention). Conceded per
    team comes from the live fixture payload's teams + goals objects.
    """
    teams_obj = fixture_data.get("teams", {}) or {}
    goals = fixture_data.get("goals", {}) or {}
    conceded_by_team_id = {
        str(((teams_obj.get("home") or {}).get("id"))): goals.get("away") or 0,
        str(((teams_obj.get("away") or {}).get("id"))): goals.get("home") or 0,
    }

    out: dict = {}
    for team_block in payload.get("response", []) or []:
        team_id = str((team_block.get("team") or {}).get("id"))
        team_conceded = conceded_by_team_id.get(team_id, 0)
        for entry in team_block.get("players", []) or []:
            api_id = (entry.get("player") or {}).get("id")
            if api_id is None:
                continue
            player = resolve_player(api_id)
            if player is None:
                continue  # not a player we know about (not drafted/synced)

            stats = (entry.get("statistics") or [{}])[0] or {}
            games = stats.get("games") or {}
            goal_stats = stats.get("goals") or {}
            cards = stats.get("cards") or {}
            penalty = stats.get("penalty") or {}
            shots = stats.get("shots") or {}
            passes = stats.get("passes") or {}
            tackles = stats.get("tackles") or {}
            duels = stats.get("duels") or {}
            dribbles = stats.get("dribbles") or {}
            minutes = games.get("minutes") or 0
            out[player.id] = {
                "minutes": minutes,
                "goals": goal_stats.get("total") or 0,
                "assists": goal_stats.get("assists") or 0,
                "saves": goal_stats.get("saves") or 0,
                "goals_conceded": goal_stats.get("conceded") or 0,
                "yellow_cards": cards.get("yellow") or 0,
                "red_cards": cards.get("red") or 0,
                "penalties_saved": penalty.get("saved") or 0,
                "penalties_missed": penalty.get("missed") or 0,
                "clean_sheets": 1 if (team_conceded == 0 and minutes >= 60) else 0,
                # Advanced metrics (Phase 3) — drive defensive contribution +
                # advanced attacking rules. API-Football has no clearances field,
                # so it stays 0; the rest come straight off the statistics block.
                "shots_on_target": shots.get("on") or 0,
                "key_passes": passes.get("key") or 0,
                "tackles": tackles.get("total") or 0,
                "blocks": tackles.get("blocks") or 0,
                "interceptions": tackles.get("interceptions") or 0,
                "clearances": 0,
                "duels_won": duels.get("won") or 0,
                "dribbles_won": dribbles.get("success") or 0,
                "rating": float(games["rating"]) if games.get("rating") else None,
            }
    return out


def _fixtures_in_live_window(db: Session, sport_id) -> list[Match]:
    """Real-API fixtures that could be live right now — the free-tier gate:
    no candidates means the poll returns without spending a single request."""
    now = datetime.now(timezone.utc)
    candidates = (
        db.query(Match)
        .filter(
            Match.sport_id == sport_id,
            Match.status.in_(["scheduled", "live"]),
            Match.match_date >= now - _LIVE_WINDOW_AFTER_KICKOFF,
            Match.match_date <= now + timedelta(minutes=5),
        )
        .all()
    )
    return [m for m in candidates if (m.external_api_id or "").isdigit()]


# Anything that kicked off this long ago is over (90' + stoppage + HT + ET/pens).
_SURELY_FINISHED_AFTER = timedelta(hours=3, minutes=30)


def _missed_finish_candidates(db: Session, sport_id) -> list[Match]:
    """Fixtures that kicked off long enough ago to be over but never reached
    'finished'. At a multi-hour poll cadence, whole matches start AND end
    between ticks — and fixtures?live=all only shows in-progress games — so
    these need a date-query reconciliation pass. Lookback capped at 26h
    because the Free plan only serves fixtures?date= within today ± 1 day."""
    now = datetime.now(timezone.utc)
    candidates = (
        db.query(Match)
        .filter(
            Match.sport_id == sport_id,
            Match.status.in_(["scheduled", "live"]),
            Match.match_date >= now - timedelta(hours=26),
            Match.match_date <= now - _SURELY_FINISHED_AFTER,
        )
        .all()
    )
    return [m for m in candidates if (m.external_api_id or "").isdigit()]


async def _finish_match(db, client, match: Match, live_key: str, fixture_data: dict, resolve_player) -> None:
    """live->finished transition: book the full FT stat sheet (saves/minutes/
    clean sheets; 1 extra request), falling back to event-count booking if the
    fetch fails or the daily budget is spent, then enqueue scoring."""
    stats_by_player: dict = {}
    try:
        players_payload = await client.get_fixture_players(fixture_id=int(match.external_api_id))
        stats_by_player = _parse_player_sheet(players_payload, fixture_data, resolve_player)
    except FootballQuotaExhausted as exc:
        logger.warning("Football FT sheet skipped for %s: %s", live_key, exc)
    except Exception:
        logger.exception("Football FT sheet request failed for fixture %s", match.external_api_id)
    if stats_by_player:
        persist_football_stats_from_sheet(
            db, match=match, live_key=live_key, stats_by_player=stats_by_player
        )
    else:
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


async def _reconcile_missed_finishes(db, client, redis, candidates: list[Match], resolve_player) -> int:
    """Fetch finals for matches the live poll skipped over (one date query per
    distinct kickoff day) and run the normal finish path for each."""
    by_day: dict[str, list[Match]] = {}
    for match in candidates:
        day = match.match_date.astimezone(timezone.utc).date().isoformat()
        by_day.setdefault(day, []).append(match)

    finished = 0
    for day, day_matches in sorted(by_day.items()):
        try:
            payload = await client.get_fixtures_by_date(day)
        except FootballQuotaExhausted as exc:
            logger.warning("Football reconcile paused: %s", exc)
            return finished
        except Exception:
            logger.exception("Football reconcile: date query failed for %s", day)
            continue
        by_id = {
            str((f.get("fixture") or {}).get("id")): f for f in payload.get("response", [])
        }
        for match in day_matches:
            fixture_data = by_id.get(match.external_api_id)
            if fixture_data is None:
                continue
            fixture = fixture_data.get("fixture", {}) or {}
            goals = fixture_data.get("goals", {}) or {}
            new_status = _STATUS_MAP.get((fixture.get("status") or {}).get("short", "NS"), "scheduled")
            finished_now = new_status == "finished" and match.status != "finished"
            match.home_score = goals.get("home")
            match.away_score = goals.get("away")
            match.status = new_status
            db.commit()

            live_key = match.external_api_id or str(match.id)
            channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
            await redis.publish(channel, WSMessage(
                event="SCORE_UPDATE",
                data={
                    "kind": "LIVE_API_RECONCILE",
                    "match_id": live_key,
                    "sport": "football",
                    "status": new_status,
                    "home": match.home_score,
                    "away": match.away_score,
                    "minute": 90,
                },
            ).model_dump_json())

            if finished_now:
                await _finish_match(db, client, match, live_key, fixture_data, resolve_player)
                finished += 1
    return finished


async def sync_football_live_matches(db: Session) -> str:
    if not get_effective_flag(db, "live_polling_enabled", default=settings.LIVE_POLLING_ENABLED):
        return "ok: live polling disabled (LIVE_POLLING_ENABLED=false)"

    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        return "ok: football sport not seeded"

    live_candidates = _fixtures_in_live_window(db, sport.id)
    missed_candidates = _missed_finish_candidates(db, sport.id)
    if not live_candidates and not missed_candidates:
        return "ok: no fixtures in live window or awaiting finals; API not called"

    client = FootballAPIClient()
    redis = await get_async_redis()

    def _resolve_player(api_player_id) -> Player | None:
        return (
            db.query(Player)
            .filter(Player.sport_id == sport.id, Player.external_api_id == str(api_player_id))
            .first()
        )

    fixtures: list = []
    if live_candidates:
        try:
            # Unfiltered live=all: one request covers every tracked league.
            payload = await client.get_live_fixtures()
            fixtures = [
                f for f in payload.get("response", [])
                if (f.get("league") or {}).get("id") in fantasy_competitions()
            ]
        except FootballQuotaExhausted as exc:
            logger.warning("Football live poll paused: %s", exc)
            return "ok: daily API budget spent; polling paused until 00:00 UTC"
        except Exception:
            logger.exception("Football live poll: live fixtures request failed")

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
            # Not a fixture the daily sync has registered yet — skip; it'll
            # be picked up once sync.football.matches creates the row.
            continue

        status_obj = fixture.get("status", {}) or {}
        new_status = _STATUS_MAP.get(status_obj.get("short", "NS"), "scheduled")
        finished_now = new_status == "finished" and match.status != "finished"
        minute = status_obj.get("elapsed") or 0

        # Live fixture responses embed their events — the per-fixture events
        # call is only a fallback, so a normal poll costs exactly 1 request.
        raw_events = fixture_data.get("events")
        if raw_events is None:
            try:
                events_payload = await client.get_match_events(fixture_id=fixture_id)
                raw_events = events_payload.get("response", [])
            except FootballQuotaExhausted:
                raw_events = []
            except Exception:
                logger.exception(
                    "Football live poll: events request failed for fixture %s", fixture_id
                )
                raw_events = []

        live_key = match.external_api_id or str(match.id)
        now = datetime.now(timezone.utc)
        rows: list[dict] = []
        # Fantasy deltas must only be applied for events not seen in earlier
        # polls — every poll re-reads the full event list, and
        # apply_live_points is incremental (hincrbyfloat). Keyed by event_id;
        # the insert's RETURNING tells us which rows were actually new.
        scorable_by_event_id: dict[str, LiveEventLike] = {}

        for raw in raw_events:
            event_minute = (raw.get("time") or {}).get("elapsed", 0)
            api_type = str(raw.get("type", ""))
            detail = str(raw.get("detail", ""))
            team = raw.get("team", {}) or {}
            mapped_type = _map_event_type(api_type, detail)

            # Assists ride on the goal event as a sibling `assist` field.
            # Only on open-play goals: penalties/own goals carry no assist.
            assist_id = (raw.get("assist") or {}).get("id")
            if mapped_type == "goal" and detail.strip().lower() == "normal goal" and assist_id:
                assist_player = _resolve_player(assist_id)
                if assist_player is not None:
                    assist_event_id = f"{fixture_id}:{event_minute}:assist:{assist_id}"
                    rows.append({
                        "match_id": live_key,
                        "event_id": assist_event_id,
                        "sport": "football",
                        "event_type": "assist",
                        "player_id": str(assist_player.id),
                        "team_id": str(team.get("id") or ""),
                        "value": 0.0,
                        "meta": {"minute": event_minute, "detail": "Assist", "source": "api-football"},
                        "ts": now,
                    })
                    scorable_by_event_id[assist_event_id] = LiveEventLike(
                        str(assist_player.id), "assist"
                    )

            player = raw.get("player", {}) or {}
            api_player_id = player.get("id")
            if api_player_id is None:
                continue

            sporty_player = _resolve_player(api_player_id)
            if sporty_player is None:
                continue  # not a player we know about (not drafted/synced)

            event_id = f"{fixture_id}:{event_minute}:{api_type}:{api_player_id}:{detail}"
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
                scorable_by_event_id[event_id] = LiveEventLike(str(sporty_player.id), mapped_type)

        scorable_events: list[LiveEventLike] = []
        if rows:
            statement = (
                pg_insert(LiveEvent)
                .values(rows)
                .on_conflict_do_nothing(index_elements=["match_id", "event_id"])
                .returning(LiveEvent.event_id)
            )
            inserted_ids = {row[0] for row in db.execute(statement)}
            scorable_events = [
                event for event_id, event in scorable_by_event_id.items()
                if event_id in inserted_ids
            ]

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
            await _finish_match(db, client, match, live_key, fixture_data, _resolve_player)

    # Catch-up: finals + stats for matches that started and ended between
    # ticks (a multi-hour cadence skips whole games; live=all can't see them).
    db.expire_all()
    still_missed = [m for m in _missed_finish_candidates(db, sport.id)]
    reconciled = 0
    if still_missed:
        reconciled = await _reconcile_missed_finishes(
            db, client, redis, still_missed, _resolve_player
        )

    # Ring the global bell so dashboard tickers refetch (they no longer poll).
    # Only when something actually changed; bust the endpoint's short-TTL cache
    # first so the triggered refetch reads fresh, not a pre-change snapshot.
    if updated or reconciled:
        cache_delete(LIVE_FAVOURITES_CACHE_KEY)
        await redis.publish(settings.LIVE_INDEX_CHANNEL, "{}")

    return (
        f"ok: polled {len(fixtures)} live fixture(s), updated {updated}, "
        f"reconciled {reconciled} missed finish(es)"
    )


# ── Pre-match predictions (once per matchday) ────────────────────────────────


def _parse_prediction(payload: dict) -> dict | None:
    """API-Football /predictions response -> the PredictionPayload shape the
    frontend already reads (home_win_prob/draw_prob/away_win_prob/model_version).
    Returns None on empty or malformed responses."""
    response = payload.get("response") or []
    if not response:
        return None
    percent = ((response[0].get("predictions") or {}).get("percent")) or {}
    try:
        probs = {
            key: float(str(percent.get(key, "")).rstrip("%")) / 100.0
            for key in ("home", "draw", "away")
        }
    except ValueError:
        return None
    total = sum(probs.values())
    if total <= 0:
        return None
    # The API rounds to whole percents; renormalize so the probs sum to 1.
    return {
        "home_win_prob": round(probs["home"] / total, 4),
        "draw_prob": round(probs["draw"] / total, 4),
        "away_win_prob": round(probs["away"] / total, 4),
        "model_version": "api-football-v3",
    }


async def sync_football_predictions(db: Session) -> str:
    """Fetch predictions for the next 24h of real-API fixtures (1 request
    each) and cache them exactly where /feed/prediction used to: Redis (24h
    TTL, keyed by both external id and match UUID) + a durable MatchFeedCache
    row. Re-runs skip already-cached fixtures, so they cost zero requests."""
    if not get_effective_flag(db, "live_polling_enabled", default=settings.LIVE_POLLING_ENABLED):
        return "ok: live polling disabled (LIVE_POLLING_ENABLED=false)"

    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        return "ok: football sport not seeded"

    now = datetime.now(timezone.utc)
    matches = (
        db.query(Match)
        .filter(
            Match.sport_id == sport.id,
            Match.status == "scheduled",
            Match.match_date >= now,
            Match.match_date <= now + timedelta(hours=24),
        )
        .all()
    )
    matches = [m for m in matches if (m.external_api_id or "").isdigit()]
    if not matches:
        return "ok: no upcoming real-API fixtures in the next 24h"

    # Reuse the feeder ingest's durable-cache helper and TTL (importing the
    # module is fine even with the /feed router unregistered in main.py).
    from app.api.v1.feed import PREDICTION_TTL_SECONDS, _persist_feed_cache

    client = FootballAPIClient()
    redis = await get_async_redis()
    cached = 0
    for match in matches:
        key = f"prediction:match:{match.external_api_id}"
        if await redis.exists(key):
            continue

        try:
            payload = await client.get_predictions(fixture_id=int(match.external_api_id))
        except FootballQuotaExhausted as exc:
            logger.warning("Football predictions paused: %s", exc)
            return f"ok: daily API budget spent after {cached} prediction(s)"
        except Exception:
            logger.exception(
                "Football predictions: request failed for fixture %s", match.external_api_id
            )
            continue

        pred = _parse_prediction(payload)
        if pred is None:
            logger.warning(
                "Football predictions: empty/malformed response for fixture %s",
                match.external_api_id,
            )
            continue

        doc = {"sporty_match_id": match.external_api_id, **pred}
        data = json.dumps(doc)
        # Both key forms — the realtime read path accepts either the
        # external id or the match UUID (same as delete_scheduled_match).
        for base in {match.external_api_id, str(match.id)}:
            await redis.setex(f"prediction:match:{base}", PREDICTION_TTL_SECONDS, data)
        _persist_feed_cache(db, match.id, "prediction", doc)
        cached += 1

    return f"ok: predictions cached for {cached} of {len(matches)} fixture(s)"
