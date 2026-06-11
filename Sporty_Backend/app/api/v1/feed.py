"""
Inbound feed from the Sporty Data Feeder (PRD Phase 5, R-5.1–R-5.5).

The feeder simulates matches and pushes authenticated JSON to these three
endpoints. Everything here is server-to-server: auth is the X-Feeder-Secret
shared header (no cookies, no CSRF), and event upserts are idempotent on
event_id so feeder retries/replays are always safe.

Routes (mounted under /api/v1):
  POST /feed/match-result   — upsert live events, update match score/status,
                              publish to the Redis match channel; on
                              status=finished trigger gameweek scoring.
  POST /feed/prediction     — cache outcome probabilities (24h TTL).
  POST /feed/player-ratings — cache post-match ratings (24h TTL); log MOTM.
"""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.core.redis import get_async_redis
from app.database import get_db
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.schemas.events import WSMessage

logger = logging.getLogger(__name__)


def _enqueue_scoring(db, *, match_date, sport_id) -> int:
    # Imported lazily: scoring.trigger ↔ celery_app ↔ tasks ↔ match_sync form
    # an import cycle that only resolves when celery_app loads first. A
    # module-level import here would enter that cycle from the wrong side.
    from app.services.scoring.scoring_trigger import enqueue_scoring_for_finished_match

    return enqueue_scoring_for_finished_match(db, match_date=match_date, sport_id=sport_id)

router = APIRouter(prefix="/feed", tags=["Feeder"])

PREDICTION_TTL_SECONDS = 86400
RATINGS_TTL_SECONDS = 86400


# ── R-5.1: shared-secret auth ────────────────────────────────────────────────


def verify_feeder_secret(
    x_feeder_secret: str | None = Header(default=None, alias="X-Feeder-Secret"),
) -> None:
    """401 on mismatch. The secret value is never logged."""
    if not settings.FEEDER_SECRET:
        logger.error("Feed push rejected: FEEDER_SECRET is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Feeder integration is not configured",
        )
    if not x_feeder_secret or not secrets.compare_digest(x_feeder_secret, settings.FEEDER_SECRET):
        logger.warning("Feed push rejected: invalid feeder secret")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid feeder secret",
        )


# ── Payload schemas (push contract, feeder PRD R-4.5) ───────────────────────


class FeedEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=255)
    event_type: str
    sporty_player_id: str | None = None
    sporty_team_id: str | None = None
    minute: int | None = None


class MatchResultPayload(BaseModel):
    sporty_match_id: str
    sport: str
    status: str
    home_score: int
    away_score: int
    current_minute: int
    events: list[FeedEvent] = []


class PredictionPayload(BaseModel):
    sporty_match_id: str
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    model_version: str


class PlayerRatingEntry(BaseModel):
    sporty_player_id: str | None = None
    rating: float
    goals: int = 0
    assists: int = 0
    minutes_played: int = 0
    events: list[str] = []


class PlayerRatingsPayload(BaseModel):
    sporty_match_id: str
    sport: str
    man_of_match_sporty_player_id: str | None = None
    ratings: list[PlayerRatingEntry] = []


class ScheduleMatchPayload(BaseModel):
    sport: str  # Sport slug: "football" | "basketball" | "cricket"
    home_team: str = Field(min_length=1, max_length=100)
    away_team: str = Field(min_length=1, max_length=100)
    match_date: datetime
    competition: str = "Feeder Simulation"
    season: str = "2025-26"
    # Idempotency key (maps to matches.external_api_id). Re-posting the same
    # ref returns the existing match instead of creating a duplicate.
    external_ref: str | None = Field(default=None, max_length=100)


# ── Helpers ──────────────────────────────────────────────────────────────────


def find_match(db, sporty_match_id: str) -> Match | None:
    """Match lookup mirrors the realtime routes: by UUID id, then by
    external_api_id."""
    try:
        match_uuid = uuid.UUID(sporty_match_id)
    except ValueError:
        match_uuid = None
    if match_uuid is not None:
        match = db.query(Match).filter(Match.id == match_uuid).first()
        if match:
            return match
    return db.query(Match).filter(Match.external_api_id == sporty_match_id).first()


def _live_key(match: Match) -> str:
    # Same key the WebSocket/SSE routes subscribe with.
    return match.external_api_id or str(match.id)


# ── Schedule a simulated match ───────────────────────────────────────────────
# Sporty matches normally come from external-API sync; feeder simulations need
# a way to register a fixture so pushes have a match to land on. Returns the
# sporty_match_id the feeder must use in all subsequent pushes.


@router.post("/schedule-match", dependencies=[Depends(verify_feeder_secret)])
async def schedule_match(payload: ScheduleMatchPayload, db=Depends(get_db)):
    sport = db.query(Sport).filter(Sport.name == payload.sport.strip().lower()).first()
    if sport is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown sport slug '{payload.sport}'",
        )

    external_ref = payload.external_ref or (
        f"feeder:{uuid.uuid5(uuid.NAMESPACE_URL, f'{payload.home_team}|{payload.away_team}|{payload.match_date.isoformat()}')}"
    )

    existing = db.query(Match).filter(Match.external_api_id == external_ref).first()
    if existing is not None:
        return {
            "sporty_match_id": str(existing.id),
            "external_ref": external_ref,
            "created": False,
        }

    match = Match(
        sport_id=sport.id,
        external_api_id=external_ref,
        home_team=payload.home_team.strip(),
        away_team=payload.away_team.strip(),
        match_date=payload.match_date,
        status="scheduled",
        competition=payload.competition,
        season=payload.season,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    logger.info("Feeder scheduled match %s: %s vs %s", match.id, match.home_team, match.away_team)
    return {
        "sporty_match_id": str(match.id),
        "external_ref": external_ref,
        "created": True,
    }


# ── R-5.2: match result + events ────────────────────────────────────────────


@router.post("/match-result", dependencies=[Depends(verify_feeder_secret)])
async def ingest_match_result(
    payload: MatchResultPayload,
    db=Depends(get_db),
    redis=Depends(get_async_redis),
):
    match = find_match(db, payload.sporty_match_id)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {payload.sporty_match_id} is not scheduled in Sporty",
        )
    live_key = _live_key(match)

    # Idempotent event upsert: ON CONFLICT (match_id, event_id) DO NOTHING,
    # so feeder retries and replay-push never duplicate rows.
    events_inserted = 0
    if payload.events:
        now = datetime.now(timezone.utc)
        rows = [
            {
                "match_id": live_key,
                "event_id": event.event_id,
                "sport": payload.sport,
                "event_type": event.event_type,
                "player_id": event.sporty_player_id or "",
                "team_id": event.sporty_team_id or "",
                "value": 0.0,
                "meta": {"minute": event.minute, "source": "feeder"},
                "ts": now,
            }
            for event in payload.events
        ]
        statement = (
            pg_insert(LiveEvent)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["match_id", "event_id"])
        )
        events_inserted = db.execute(statement).rowcount or 0

    match.home_score = payload.home_score
    match.away_score = payload.away_score
    finished_now = payload.status == "finished" and match.status != "finished"
    match.status = payload.status
    db.commit()

    # Data keys follow the canonical ScoreUpdate shape (home/away/minute) that
    # the frontend matchStore applies; kind/status/events are additive extras.
    channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
    message = WSMessage(
        event="SCORE_UPDATE",
        data={
            "kind": "FEED_MATCH_RESULT",
            "match_id": live_key,
            "sport": payload.sport,
            "status": payload.status,
            "home": payload.home_score,
            "away": payload.away_score,
            "minute": payload.current_minute,
            "events": [event.model_dump() for event in payload.events],
        },
    )
    await redis.publish(channel, message.model_dump_json())

    # R-5.5: a finished match triggers gameweek scoring immediately —
    # don't wait for the daily cron.
    scoring_enqueued = 0
    if finished_now:
        scoring_enqueued = _enqueue_scoring(
            db, match_date=match.match_date, sport_id=match.sport_id
        )
        logger.info(
            "Feeder finished match %s: enqueued scoring for %s transfer window(s)",
            live_key,
            scoring_enqueued,
        )

    return {
        "status": "ok",
        "match_id": live_key,
        "events_received": len(payload.events),
        "events_inserted": events_inserted,
        "scoring_enqueued": scoring_enqueued,
    }


# ── R-5.3: prediction cache ──────────────────────────────────────────────────


@router.post("/prediction", dependencies=[Depends(verify_feeder_secret)])
async def ingest_prediction(
    payload: PredictionPayload,
    redis=Depends(get_async_redis),
):
    key = f"prediction:match:{payload.sporty_match_id}"
    await redis.setex(key, PREDICTION_TTL_SECONDS, payload.model_dump_json())
    return {"status": "ok", "cached_key": key, "ttl_seconds": PREDICTION_TTL_SECONDS}


# ── R-5.4: player ratings cache ──────────────────────────────────────────────


@router.post("/player-ratings", dependencies=[Depends(verify_feeder_secret)])
async def ingest_player_ratings(
    payload: PlayerRatingsPayload,
    redis=Depends(get_async_redis),
):
    key = f"ratings:match:{payload.sporty_match_id}"
    await redis.setex(key, RATINGS_TTL_SECONDS, payload.model_dump_json())
    logger.info(
        "Player ratings received for match %s (%s players); man of the match: %s",
        payload.sporty_match_id,
        len(payload.ratings),
        payload.man_of_match_sporty_player_id,
    )
    return {
        "status": "ok",
        "cached_key": key,
        "ttl_seconds": RATINGS_TTL_SECONDS,
        "ratings_received": len(payload.ratings),
    }
