"""Live NBA scores — display-only liveness, gated by settings.LIVE_POLLING_ENABLED.

Same division of labour as football's SportScore layer
(app/services/sync/sportscore_live_sync.py): this module keeps the scoreboard
and match status fresh for the live match page, and does NOT own fantasy
points. Points come from the authoritative per-window box-score rollup in
basketball_stats_sync, which this module triggers on the live -> finished
transition.

Provider: BallDontLie /games?dates[] — the SAME provider our fixtures come from,
so a game's id IS the fixture's external_api_id ("bdl:<id>") and no id bridge
is needed. One request covers the whole slate, which on the free tier's 5
req/min leaves plenty of headroom for a tight tick.

Why not per-player live points like football has: BallDontLie's per-player box
scores are a paid tier, and the free alternative (stats.nba.com) soft-blocks an
IP after modest use — it accepts the connection and then never responds, which
is indistinguishable from a hang. Driving a 2-minute poll off that would make
the live page unreliable to save a $9.99/mo upgrade. So team scores tick live
and player points land at the final buzzer. Upgrading to BallDontLie ALL-STAR
would let this module also diff /stats into live per-player points.

Cost control: _fixtures_in_live_window is a DB query, so a tick with no fixture
in play returns before any network call — the entire off-season and every
daytime tick are free.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.admin.feature_flags import get_effective_flag
from app.core.config import settings
from app.core.redis import get_async_redis
from app.league.models import Sport
from app.match.models import Match
from app.models.schemas.events import WSMessage
from app.services.scoring.trigger import enqueue_scoring_for_finished_match

logger = logging.getLogger(__name__)

# An NBA game runs ~2.5h; the window opens just before tip-off and stays open
# long enough to catch a finish the previous tick missed.
_WINDOW_BEFORE = timedelta(minutes=5)
_WINDOW_AFTER = timedelta(hours=4)


def _fixtures_in_live_window(db: Session, sport_id) -> list[Match]:
    """Basketball fixtures that could plausibly be in play right now.

    The whole point of this gate is that an empty result costs zero API calls —
    which is every tick outside a game night.
    """
    now = datetime.now(timezone.utc)
    return (
        db.query(Match)
        .filter(
            Match.sport_id == sport_id,
            Match.status.in_(("scheduled", "live")),
            Match.match_date >= now - _WINDOW_AFTER,
            Match.match_date <= now + _WINDOW_BEFORE,
        )
        .all()
    )


def game_state(game: dict) -> str:
    """BallDontLie game payload -> our Match.status.

    `status` is an ISO timestamp until a game starts and free text afterwards
    ("1st Qtr", "Final"), so `status_state` is the field to trust; it is checked
    first and the text is only a fallback for older payload shapes.
    """
    state = str(game.get("status_state") or "").lower()
    if state in ("final", "post"):
        return "finished"
    if state in ("in", "live"):
        return "live"
    if state == "scheduled":
        return "scheduled"

    status_text = str(game.get("status") or "").lower()
    if "final" in status_text:
        return "finished"
    return "live" if game.get("period") else "scheduled"


async def sync_nba_live_matches(db: Session) -> str:
    if not get_effective_flag(db, "live_polling_enabled", default=settings.LIVE_POLLING_ENABLED):
        return "ok: live polling disabled (LIVE_POLLING_ENABLED=false); using simulator"

    if not settings.BALLDONTLIE_API_KEY:
        return "ok: BALLDONTLIE_API_KEY not configured"

    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        return "ok: basketball sport not seeded"

    candidates = {
        match.external_api_id: match
        for match in _fixtures_in_live_window(db, sport.id)
        if match.external_api_id
    }
    if not candidates:
        return "ok: no NBA fixtures in the live window"

    from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient

    client = BasketballBallDontLieClient(api_key=settings.BALLDONTLIE_API_KEY)
    # A US evening game is already "tomorrow" in UTC, so ask for both days.
    now = datetime.now(timezone.utc)
    dates = [(now - timedelta(days=1)).date().isoformat(), now.date().isoformat()]
    games = await client.get_games_by_date(dates)
    if not games:
        return "ok: no NBA games returned for the live window"

    redis = await get_async_redis()
    updated = 0

    for game in games:
        # Fixtures and live scores come from the same provider, so this is a
        # direct key lookup — no team/date matching of any kind.
        match = candidates.get(f"bdl:{game.get('id')}")
        if match is None:
            continue

        new_status = game_state(game)
        if new_status == "scheduled":
            continue

        finished_now = new_status == "finished" and match.status != "finished"
        match.home_score = _coerce_int(game.get("home_team_score"))
        match.away_score = _coerce_int(game.get("visitor_team_score"))
        match.status = new_status
        db.commit()
        updated += 1

        live_key = match.external_api_id or str(match.id)
        channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
        await redis.publish(
            channel,
            WSMessage(
                event="SCORE_UPDATE",
                data={
                    "kind": "LIVE_API_POLL",
                    "match_id": live_key,
                    "sport": "basketball",
                    "status": new_status,
                    "home": match.home_score,
                    "away": match.away_score,
                    "minute": game.get("status") if new_status == "live" else None,
                    "period": game.get("period"),
                },
            ).model_dump_json(),
        )

        if finished_now:
            await _book_finished_match(db, match, live_key)

    return f"ok: polled {len(games)} NBA game(s), updated {updated}"


async def _book_finished_match(db: Session, match: Match, live_key: str) -> None:
    """Turn a just-finished game into fantasy points.

    Recomputes the WHOLE covering window, not this one match: PlayerGameweekStat
    is one row per (player, window) and an NBA team plays 3-4 games inside a
    weekly window, so booking one match's numbers onto it would erase the games
    before it. The rollup sums every game in the window, so it converges however
    often it runs.
    """
    from app.services.scoring.window_locator import find_transfer_window_for_datetime
    from app.services.sync.basketball_stats_sync import sync_basketball_window_stats

    try:
        window = find_transfer_window_for_datetime(
            db, match_date=match.match_date, sport_id=match.sport_id
        )
        if window is None:
            logger.warning(
                "NBA live poll: no transfer window covers %s; stats not booked", match.match_date
            )
        else:
            await sync_basketball_window_stats(db, window)
    except Exception:
        logger.exception("NBA live poll: window stat rollup failed for %s", live_key)

    try:
        enqueue_scoring_for_finished_match(
            db, match_date=match.match_date, sport_id=match.sport_id
        )
    except Exception:
        logger.exception(
            "NBA live poll: finish %s recorded but scoring enqueue failed", live_key
        )


def _coerce_int(value, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default
