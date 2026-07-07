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
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.core.redis import get_async_redis
from app.database import get_db
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.db.match_feed_cache import MatchFeedCache
from app.models.schemas.events import WSMessage
from app.player.models import Player, RealTeam
from app.services import notification_service
from app.services.feed_scoring import apply_live_points, persist_match_stats
from app.auth.models import AuthProvider, User
from app.core.security import hash_password
from app.league.models import (
    FantasyTeam,
    FantasyTeamStatus,
    League,
    LeagueMembership,
    LeagueMembershipStatus,
    LeagueStatus,
    Season,
    TeamGameweekLineup,
    TransferWindow,
)

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
LINEUPS_TTL_SECONDS = 86400
# Global (not match-scoped) model-performance scorecard; refreshed by the
# feeder after every finished match, so a long TTL only matters when the
# feeder goes quiet.
MODEL_METRICS_TTL_SECONDS = 7 * 86400
MODEL_METRICS_KEY = "model:metrics"


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
    # Substitutions: the player coming OFF (sporty_player_id is the player
    # coming on). Ignored for every other event type.
    related_sporty_player_id: str | None = None


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


class MatchLineupsPayload(BaseModel):
    sporty_match_id: str
    home: list[str] = []  # player UUIDs playing for the home team
    away: list[str] = []  # player UUIDs playing for the away team


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


def _persist_feed_cache(db, match_id, kind: str, payload: dict) -> None:
    """Durable backstop for a Redis push (prediction/ratings/lineups) so a GET
    still has something to serve once the 24h TTL cache entry expires."""
    statement = (
        pg_insert(MatchFeedCache)
        .values([{"match_id": match_id, "kind": kind, "payload": payload}])
        .on_conflict_do_update(
            index_elements=["match_id", "kind"],
            set_={"payload": payload, "updated_at": func.now()},
        )
    )
    db.execute(statement)
    db.commit()


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


# ── Delete a scheduled match ─────────────────────────────────────────────────
# The counterpart to schedule-match: lets the feeder remove a fixture it created
# (and everything derived from it) when a simulation is cancelled or cleaned up.


@router.delete("/schedule-match/{sporty_match_id}", dependencies=[Depends(verify_feeder_secret)])
async def delete_scheduled_match(
    sporty_match_id: str,
    force: bool = False,
    db=Depends(get_db),
    redis=Depends(get_async_redis),
):
    """Delete a feeder-scheduled match and its derived data.

    Removes the match row, its live_events, and cached realtime payloads
    (prediction/ratings/lineups/fantasy points) in Redis. Accepts either the
    Sporty match UUID or the feeder external_ref (same lookup as every push).

    Refuses to delete a LIVE match (409) so an in-progress broadcast is never
    pulled out from under connected clients — cancel/finish it first, OR pass
    `?force=true` to override (used to clean up a simulation orphaned in `live`
    after the feeder died mid-run). Unknown ids return 404.
    """
    match = find_match(db, sporty_match_id)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {sporty_match_id} not found",
        )
    if match.status == "live" and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a live match — finish it or pass force=true to override",
        )

    live_key = _live_key(match)
    match_uuid_str = str(match.id)

    # live_events reference the match by its string key (no FK), which may be the
    # external_ref or the UUID depending on how it was pushed — clear all forms.
    event_keys = {live_key, match_uuid_str}
    if match.external_api_id:
        event_keys.add(match.external_api_id)
    events_deleted = (
        db.query(LiveEvent)
        .filter(LiveEvent.match_id.in_(event_keys))
        .delete(synchronize_session=False)
    )

    db.delete(match)
    db.commit()

    # Best-effort Redis cleanup — a stale cache must never fail the delete.
    try:
        cache_keys: list[str] = []
        for base in {live_key, match_uuid_str}:
            cache_keys += [
                f"prediction:match:{base}",
                f"ratings:match:{base}",
                f"lineups:match:{base}",
            ]
            cache_keys += await redis.keys(f"fantasy:match:{base}:player:*")
        if cache_keys:
            await redis.delete(*cache_keys)
    except Exception:  # noqa: BLE001 — cache is derived, safe to leave stale
        logger.warning(
            "Redis cache cleanup failed for deleted match %s", sporty_match_id,
            exc_info=True,
        )

    logger.info(
        "Feeder deleted match %s (%s live_events removed)",
        sporty_match_id, events_deleted,
    )
    return {
        "sporty_match_id": match_uuid_str,
        "deleted": True,
        "events_deleted": events_deleted,
    }


# ── Register feeder players ──────────────────────────────────────────────────
# Feeder simulations invent their own rosters; for fantasy scoring the backend
# must hold a Player row per simulated player so live_events (carrying that
# player's UUID) fold into player_gameweek_stats. The feeder posts its lineup
# here (idempotent on external_ref) and gets back the UUIDs to use as
# sporty_player_id in subsequent pushes.


class RegisterPlayerEntry(BaseModel):
    external_ref: str = Field(min_length=1, max_length=100)  # feeder's stable id
    name: str = Field(min_length=1, max_length=150)
    position: str = "MID"
    real_team: str = Field(min_length=1, max_length=100)
    cost: float = 5.0


class RegisterPlayersPayload(BaseModel):
    sport: str
    players: list[RegisterPlayerEntry]


def _get_or_create_real_team(db, sport_id, name: str) -> RealTeam:
    team = (
        db.query(RealTeam)
        .filter(RealTeam.sport_id == sport_id, RealTeam.name == name)
        .first()
    )
    if team is None:
        team = RealTeam(
            sport_id=sport_id,
            name=name,
            external_api_id=f"feeder:team:{sport_id}:{name}",
        )
        db.add(team)
        db.flush()
    return team


@router.post("/register-players", dependencies=[Depends(verify_feeder_secret)])
async def register_players(payload: RegisterPlayersPayload, db=Depends(get_db)):
    sport = db.query(Sport).filter(Sport.name == payload.sport.strip().lower()).first()
    if sport is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown sport slug '{payload.sport}'",
        )

    mapping: dict[str, str] = {}
    created = 0
    for entry in payload.players:
        player = (
            db.query(Player).filter(Player.external_api_id == entry.external_ref).first()
        )
        if player is None:
            team = _get_or_create_real_team(db, sport.id, entry.real_team.strip())
            player = Player(
                sport_id=sport.id,
                external_api_id=entry.external_ref,
                name=entry.name.strip(),
                position=(entry.position.strip() or "MID"),
                real_team=entry.real_team.strip(),
                real_team_id=team.id,
                cost=entry.cost,
                is_available=True,
            )
            db.add(player)
            db.flush()
            created += 1
        mapping[entry.external_ref] = str(player.id)
    db.commit()
    logger.info("Feeder registered %s players (%s new) for %s", len(mapping), created, payload.sport)
    return {"status": "ok", "players": mapping, "created": created}


# ── Resolve EXISTING players (real-league flow) ──────────────────────────────
# Unlike register-players (which creates feeder-owned rows), this maps a feeder
# lineup to the players that ALREADY exist in the backend — the ones real users
# drafted — so a simulated match credits their actual fantasy teams. Matching is
# by accent/diacritic-folded name, with real_team as a tiebreaker. No rows are
# ever created; unmatched entries are simply absent from the response.


def _fold_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = stripped.lower()
    for src, dst in (("ø", "o"), ("å", "a"), ("æ", "ae"), ("ß", "ss"), ("ł", "l"), ("đ", "d")):
        lowered = lowered.replace(src, dst)
    return " ".join(lowered.split())


class ResolvePlayerEntry(BaseModel):
    external_ref: str = Field(min_length=1, max_length=100)  # echoed back as the map key
    name: str = Field(min_length=1, max_length=150)
    real_team: str | None = Field(default=None, max_length=100)


class ResolvePlayersPayload(BaseModel):
    sport: str
    players: list[ResolvePlayerEntry]


@router.post("/resolve-players", dependencies=[Depends(verify_feeder_secret)])
async def resolve_players(payload: ResolvePlayersPayload, db=Depends(get_db)):
    sport = db.query(Sport).filter(Sport.name == payload.sport.strip().lower()).first()
    if sport is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown sport slug '{payload.sport}'",
        )

    by_name: dict[str, list[Player]] = {}
    for player in db.query(Player).filter(Player.sport_id == sport.id).all():
        by_name.setdefault(_fold_name(player.name), []).append(player)

    mapping: dict[str, str] = {}
    details: list[dict] = []
    for entry in payload.players:
        candidates = by_name.get(_fold_name(entry.name), [])
        if not candidates:
            continue
        chosen = candidates[0]
        if entry.real_team and len(candidates) > 1:
            wanted = _fold_name(entry.real_team)
            for candidate in candidates:
                have = _fold_name(candidate.real_team or "")
                if have and (have == wanted or wanted in have or have in wanted):
                    chosen = candidate
                    break
        mapping[entry.external_ref] = str(chosen.id)
        details.append({
            "external_ref": entry.external_ref,
            "sporty_player_id": str(chosen.id),
            "name": chosen.name,
            "real_team": chosen.real_team,
            "external_api_id": chosen.external_api_id,
        })
    logger.info("Feeder resolved %s/%s players for %s", len(mapping), len(payload.players), payload.sport)
    return {"status": "ok", "players": mapping, "details": details, "matched": len(mapping)}


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
                "meta": {
                    "minute": event.minute,
                    "source": "feeder",
                    "related_player_id": event.related_sporty_player_id or None,
                },
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

    # Resolve player names for this batch so the live feed renders readable
    # events (not UUIDs) without the client needing a round-trip per event.
    # A feeder id may be our Player.id (matched case-insensitively) or the
    # player's external_api_id; key the lookup by the exact sporty_player_id so
    # resolution survives whatever case/form the feed sent.
    names: dict[str, dict] = {}
    player_uuid_by_sporty_id: dict[str, uuid.UUID] = {}
    batch_ids = [e.sporty_player_id for e in payload.events if e.sporty_player_id]
    batch_ids += [e.related_sporty_player_id for e in payload.events if e.related_sporty_player_id]
    if batch_ids:
        lowered = list({pid.lower() for pid in batch_ids})
        matched = db.execute(
            text(
                """
                SELECT id::text AS id, external_api_id, name, real_team
                FROM players
                WHERE lower(id::text) = ANY(:lowered) OR external_api_id = ANY(:ids)
                """
            ),
            {"lowered": lowered, "ids": batch_ids},
        ).mappings().all()
        by_lower_id = {r["id"].lower(): r for r in matched if r["id"]}
        by_ext = {r["external_api_id"]: r for r in matched if r["external_api_id"]}
        for pid in batch_ids:
            row = by_lower_id.get(pid.lower()) or by_ext.get(pid)
            if row:
                names[pid] = {"name": row["name"], "team": row["real_team"]}
                player_uuid_by_sporty_id[pid] = uuid.UUID(row["id"])

    # Resolve each event's sporty_team_id to our internal RealTeam.id (same
    # dual lookup as players above: feeder may send our own id or its own
    # external_api_id) — needed so notify_favourite_event can match on the
    # actual FK, not the feeder's opaque team identifier.
    team_uuid_by_sporty_id: dict[str, uuid.UUID] = {}
    team_batch_ids = list({e.sporty_team_id for e in payload.events if e.sporty_team_id})
    if team_batch_ids:
        lowered_teams = [tid.lower() for tid in team_batch_ids]
        matched_teams = db.execute(
            text(
                """
                SELECT id::text AS id, external_api_id
                FROM real_teams
                WHERE lower(id::text) = ANY(:lowered) OR external_api_id = ANY(:ids)
                """
            ),
            {"lowered": lowered_teams, "ids": team_batch_ids},
        ).mappings().all()
        by_lower_team = {r["id"].lower(): r["id"] for r in matched_teams if r["id"]}
        by_ext_team = {r["external_api_id"]: r["id"] for r in matched_teams if r["external_api_id"]}
        for tid in team_batch_ids:
            resolved = by_lower_team.get(tid.lower()) or by_ext_team.get(tid)
            if resolved:
                team_uuid_by_sporty_id[tid] = uuid.UUID(resolved)

    def _event_dict(event) -> dict:
        info = names.get(event.sporty_player_id or "")
        related_info = names.get(event.related_sporty_player_id or "")
        return {
            **event.model_dump(),
            "player_name": info["name"] if info else None,
            "team": info["team"] if info else None,
            "related_player_name": related_info["name"] if related_info else None,
            "related_team": related_info["team"] if related_info else None,
        }

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
            "events": [_event_dict(event) for event in payload.events],
        },
    )
    await redis.publish(channel, message.model_dump_json())

    # Substitutions additionally publish the dedicated LINEUP_CHANGE message the
    # frontend's LineupCard listens for (player_in = the event's player,
    # player_out = related_sporty_player_id; names resolved above when linked).
    for event in payload.events:
        if event.event_type != "substitution" or not event.sporty_player_id:
            continue
        info_in = names.get(event.sporty_player_id or "")
        info_out = names.get(event.related_sporty_player_id or "")
        lineup_message = WSMessage(
            event="LINEUP_CHANGE",
            data={
                "match_id": live_key,
                "team_id": event.sporty_team_id or "",
                "player_in": event.sporty_player_id,
                "player_out": event.related_sporty_player_id,
                "player_in_name": info_in["name"] if info_in else None,
                "player_out_name": info_out["name"] if info_out else None,
                "minute": event.minute,
            },
        )
        await redis.publish(channel, lineup_message.model_dump_json())

    # Favourite-team/player notifications (in-app + email) for goals in this
    # batch. Best-effort and fully isolated from the rest of ingestion: a
    # notification/email failure must never fail the feeder's request or
    # block scoring below. On failure, roll back so this block's partial
    # writes don't poison the session for the finished-match commit further
    # down (same lesson as the scoring-engine deadlock fix elsewhere in this
    # codebase — a caught exception without a rollback leaves the session
    # unusable for whatever runs next).
    goal_events = [e for e in payload.events if e.event_type == "goal"]
    if goal_events:
        try:
            notified_any = False
            for event in goal_events:
                resolved_player_id = player_uuid_by_sporty_id.get(event.sporty_player_id or "")
                resolved_team_id = team_uuid_by_sporty_id.get(event.sporty_team_id or "")
                if resolved_player_id is None and resolved_team_id is None:
                    continue
                info = names.get(event.sporty_player_id or "")
                scorer = info["name"] if info else "Your favourite player"
                team_name = info["team"] if info else "your favourite team"
                if notification_service.notify_favourite_event(
                    db,
                    player_id=resolved_player_id,
                    team_id=resolved_team_id,
                    message=f"⚽ Goal! {scorer} scored for {team_name}.",
                ):
                    notified_any = True
            if notified_any:
                db.commit()
        except Exception:
            logger.exception("Feeder match %s: favourite-event notification fanout failed", live_key)
            db.rollback()

    # Live per-player fantasy deltas → Redis hashes + FANTASY_POINTS_DELTA so the
    # frontend PointsCard ticks up during the match (needs linked player ids).
    await apply_live_points(
        redis, live_key=live_key, sport=payload.sport, events=payload.events, channel=channel
    )

    # R-5.5: a finished match folds its events into the gameweek stat tables and
    # triggers scoring immediately — don't wait for the daily cron.
    #
    # Re-runs on EVERY "finished" push, not just the first live→finished
    # transition: persist_match_stats is idempotent per match (recomputes and
    # assigns from that match's full live_events every time), so if the
    # feeder's final events batch lands in a push after the one that first set
    # status=finished, this still picks it up instead of silently dropping it.
    scoring_enqueued = 0
    stats_summary: dict = {}
    if payload.status == "finished":
        stats_summary = persist_match_stats(db, match=match, live_key=live_key, sport=payload.sport)
        db.commit()
        # Best-effort: stats are already booked and committed above, so a
        # Celery/broker failure here must NOT 500 the ingest or break the live
        # feed. The daily ranking cron re-scores the window as a fallback.
        try:
            scoring_enqueued = _enqueue_scoring(
                db, match_date=match.match_date, sport_id=match.sport_id
            )
        except Exception:
            logger.exception(
                "Feeder finish %s: stats booked but scoring enqueue failed (cron will re-score)",
                live_key,
            )
            scoring_enqueued = 0
        logger.info(
            "Feeder finished match %s (newly finished=%s): booked stats for %s player(s), enqueued scoring for %s window(s)",
            live_key,
            finished_now,
            stats_summary.get("players", 0),
            scoring_enqueued,
        )

    return {
        "status": "ok",
        "match_id": live_key,
        "events_received": len(payload.events),
        "events_inserted": events_inserted,
        "scoring_enqueued": scoring_enqueued,
        "stats_booked": stats_summary,
    }


# ── R-5.3: prediction cache ──────────────────────────────────────────────────


@router.post("/prediction", dependencies=[Depends(verify_feeder_secret)])
async def ingest_prediction(
    payload: PredictionPayload,
    db=Depends(get_db),
    redis=Depends(get_async_redis),
):
    match = find_match(db, payload.sporty_match_id)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {payload.sporty_match_id} is not scheduled in Sporty",
        )
    key = f"prediction:match:{payload.sporty_match_id}"
    await redis.setex(key, PREDICTION_TTL_SECONDS, payload.model_dump_json())
    _persist_feed_cache(db, match.id, "prediction", payload.model_dump(mode="json"))
    return {"status": "ok", "cached_key": key, "ttl_seconds": PREDICTION_TTL_SECONDS}


# ── Model-performance scorecard cache ────────────────────────────────────────
# The feeder scores its stored predictions against finished matches
# (GET /predict/metrics on the feeder) and pushes the scorecard here after each
# finished simulation; the frontend reads it via GET /api/model-metrics.


class ModelMetricsPayload(BaseModel):
    generated_at: str
    finished_matches_scored: int
    predictions_scored: int
    # {model_version: {n, accuracy, log_loss, brier, ece, calibration: [...]}}
    by_model_version: dict[str, dict] = {}


@router.post("/model-metrics", dependencies=[Depends(verify_feeder_secret)])
async def ingest_model_metrics(
    payload: ModelMetricsPayload,
    redis=Depends(get_async_redis),
):
    await redis.setex(
        MODEL_METRICS_KEY, MODEL_METRICS_TTL_SECONDS, payload.model_dump_json()
    )
    return {
        "status": "ok",
        "cached_key": MODEL_METRICS_KEY,
        "ttl_seconds": MODEL_METRICS_TTL_SECONDS,
        "model_versions": sorted(payload.by_model_version),
    }


# ── R-5.4: player ratings cache ──────────────────────────────────────────────


@router.post("/player-ratings", dependencies=[Depends(verify_feeder_secret)])
async def ingest_player_ratings(
    payload: PlayerRatingsPayload,
    db=Depends(get_db),
    redis=Depends(get_async_redis),
):
    match = find_match(db, payload.sporty_match_id)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {payload.sporty_match_id} is not scheduled in Sporty",
        )
    key = f"ratings:match:{payload.sporty_match_id}"
    await redis.setex(key, RATINGS_TTL_SECONDS, payload.model_dump_json())
    _persist_feed_cache(db, match.id, "ratings", payload.model_dump(mode="json"))
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


# ── Match lineups cache (who's playing, per team) ────────────────────────────


@router.post("/match-lineups", dependencies=[Depends(verify_feeder_secret)])
async def ingest_match_lineups(
    payload: MatchLineupsPayload,
    db=Depends(get_db),
    redis=Depends(get_async_redis),
):
    match = find_match(db, payload.sporty_match_id)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {payload.sporty_match_id} is not scheduled in Sporty",
        )
    key = f"lineups:match:{payload.sporty_match_id}"
    await redis.setex(key, LINEUPS_TTL_SECONDS, payload.model_dump_json())
    _persist_feed_cache(db, match.id, "lineups", payload.model_dump(mode="json"))
    return {
        "status": "ok",
        "cached_key": key,
        "home": len(payload.home),
        "away": len(payload.away),
    }


# ── Demo fantasy setup (local demos only) ────────────────────────────────────
# Idempotently ensures a demo user + league + open transfer window + a fantasy
# team whose lineup is the given players, so a finished simulated match credits
# a *user's* fantasy total (not just per-player points). Safe to call repeatedly.

DEMO_USER_EMAIL = "demo@sporty.local"
DEMO_PASSWORD = "demo1234!"


class DemoSetupPayload(BaseModel):
    sport: str
    sporty_match_id: str
    player_uuids: list[str] = []
    captain_uuid: str | None = None


def _get_or_create(db, model, defaults: dict | None = None, **keys):
    obj = db.query(model).filter_by(**keys).first()
    if obj is None:
        obj = model(**keys, **(defaults or {}))
        db.add(obj)
        db.flush()
    return obj


@router.post("/demo-setup", dependencies=[Depends(verify_feeder_secret)])
async def demo_setup(payload: DemoSetupPayload, db=Depends(get_db)):
    sport = db.query(Sport).filter(Sport.name == payload.sport.strip().lower()).first()
    if sport is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Unknown sport slug '{payload.sport}'")

    match = find_match(db, payload.sporty_match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    now = datetime.now(timezone.utc)
    match_dt = match.match_date or now
    if match_dt.tzinfo is None:
        match_dt = match_dt.replace(tzinfo=timezone.utc)

    # Demo user (LOCAL auth, known password for frontend login).
    user = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    if user is None:
        user = User(
            username="demo", email=DEMO_USER_EMAIL, auth_provider=AuthProvider.LOCAL,
            password_hash=hash_password(DEMO_PASSWORD), is_active=True,
        )
        db.add(user)
        db.flush()

    # Season + an open transfer window spanning both now and the match date.
    season = _get_or_create(
        db, Season, sport_id=sport.id, name="Feeder Demo Season",
        defaults={"start_date": (min(now, match_dt) - timedelta(days=30)).date(),
                  "end_date": (max(now, match_dt) + timedelta(days=120)).date(), "is_active": True},
    )
    win_start = min(now, match_dt) - timedelta(days=7)
    win_end = max(now, match_dt) + timedelta(days=90)
    window = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == season.id,
                TransferWindow.start_at <= match_dt, TransferWindow.end_at > match_dt)
        .first()
    )
    if window is None:
        window = TransferWindow(
            season_id=season.id, number=99, start_at=win_start, end_at=win_end,
            # Start-anchored deadlines (locks when the window opens) to match the
            # canonical convention in generate_transfer_windows.
            transfer_deadline_at=win_start,
            lineup_deadline_at=win_start + timedelta(minutes=1),
        )
        db.add(window)
        db.flush()

    # League + membership + fantasy team for the demo user. The demo league is
    # per-sport (one season per sport), and League.invite_code is globally
    # unique — so the code must be sport-scoped, otherwise the second sport's
    # demo-setup collides on "FEEDERDEMO01" and 500s. "FEEDERDEMO-" (11) + 5 of
    # the sport slug stays within String(16).
    demo_invite_code = f"FEEDERDEMO-{sport.name[:5].upper()}"
    league = _get_or_create(
        db, League, season_id=season.id, name="Feeder Demo League",
        defaults={"owner_id": user.id, "invite_code": demo_invite_code,
                  "status": LeagueStatus.ACTIVE, "max_teams": 10,
                  "budget_per_team": 100, "squad_size": 15},
    )
    _get_or_create(
        db, LeagueMembership, league_id=league.id, user_id=user.id,
        defaults={"status": LeagueMembershipStatus.ACTIVE},
    )
    team = _get_or_create(
        db, FantasyTeam, league_id=league.id, user_id=user.id,
        defaults={"name": "Demo XI", "current_budget": 100, "starting_budget": 100,
                  "starting_squad_size": max(1, len(payload.player_uuids)),
                  "status": FantasyTeamStatus.ACTIVE},
    )

    # Replace this window's lineup with the given (existing) players.
    valid_ids = [
        pid for (pid,) in db.query(Player.id).filter(
            Player.id.in_([uuid.UUID(p) for p in payload.player_uuids])
        ).all()
    ]
    db.query(TeamGameweekLineup).filter_by(
        fantasy_team_id=team.id, transfer_window_id=window.id
    ).delete()
    captain = payload.captain_uuid
    for index, pid in enumerate(valid_ids):
        db.add(TeamGameweekLineup(
            fantasy_team_id=team.id, transfer_window_id=window.id, player_id=pid,
            is_captain=(str(pid) == captain) or (captain is None and index == 0),
            is_vice_captain=(index == 1),
        ))
    db.commit()

    return {
        "status": "ok",
        "demo_user": {"email": DEMO_USER_EMAIL, "password": DEMO_PASSWORD},
        "league_id": str(league.id),
        "fantasy_team_id": str(team.id),
        "transfer_window_id": str(window.id),
        "lineup_size": len(valid_ids),
    }
