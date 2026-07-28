"""
Scoring bridge for feeder-simulated matches.

The Kafka realtime pipeline is disabled and the gameweek engine only reads
the stat tables, so feeder events would otherwise never touch fantasy
scoring. This module closes both gaps without Kafka:

  - apply_live_points: per-event fantasy deltas during a live simulation —
    increments the same ``fantasy:match:{key}:player:{id}`` Redis hashes the
    points engine would, and publishes FANTASY_POINTS_DELTA so the frontend
    PointsCard updates live. Delta weights mirror the batch engine's default
    scoring rules so live numbers agree with the final gameweek totals.

  - persist_match_stats: on the live→finished transition, aggregates the
    match's stored live_events per player into PlayerGameweekStat +
    FootballStat/NBAStat for every transfer window covering the match date.
    The gameweek engine (triggered right after) then computes fantasy points,
    team weekly scores, and rankings exactly as it does for imported stats.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.models.schemas.events import WSMessage
from app.player.models import FootballStat, Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.services.scoring.window_locator import find_transfer_window_ids_for_datetime
from app.services.sync.football_competitions import fantasy_tag_for_competition_name

logger = logging.getLogger(__name__)

MATCH_MINUTES = {"football": 90, "basketball": 48}

# Live per-event fantasy deltas, consistent with the batch defaults:
# football_goal=5, football_assist=3, yellow=-1, red=-2 (FOOTBALL_ACTIONS);
# NBA: (points/10)*3 + (assists/10)*2 + rebounds*1 + steals*2 + blocks*2.
FOOTBALL_EVENT_POINTS: dict[str, float] = {
    "goal": 5.0,
    "assist": 3.0,
    "yellow_card": -1.0,
    "red_card": -2.0,
}
BASKETBALL_EVENT_POINTS: dict[str, float] = {
    "point_2": 0.6,   # 2 game points * 3/10
    "point_3": 0.9,   # 3 game points * 3/10
    "free_throw": 0.3,
    "assist": 0.2,    # 1 assist * 2/10
    "rebound": 1.0,
    "steal": 2.0,
    "block": 2.0,
}


def fantasy_delta(sport: str, event_type: str) -> float:
    table = BASKETBALL_EVENT_POINTS if sport == "basketball" else FOOTBALL_EVENT_POINTS
    return table.get(event_type, 0.0)


class LiveEventLike:
    """Minimal (sporty_player_id, event_type) shape apply_live_points needs.

    feed.py's own FeedEvent (pydantic, parsed from the feeder's push payload)
    satisfies this same shape by attribute access. Real-API live pollers
    (app/services/sync/football_live_sync.py, nba_live_sync.py) have no
    incoming payload to parse, so they build these directly."""

    __slots__ = ("sporty_player_id", "event_type")

    def __init__(self, sporty_player_id: str, event_type: str):
        self.sporty_player_id = sporty_player_id
        self.event_type = event_type


async def apply_live_points(redis, *, live_key: str, sport: str, events, channel: str) -> int:
    """Accumulate per-player deltas for one minute batch, update the Redis
    hashes the realtime endpoints read, and publish FANTASY_POINTS_DELTA
    messages. Returns the number of players whose points changed."""
    deltas: dict[str, float] = defaultdict(float)
    for event in events:
        player_id = event.sporty_player_id
        if not player_id:
            continue
        delta = fantasy_delta(sport, event.event_type)
        if delta:
            deltas[player_id] += delta

    ts = int(time.time())
    for player_id, delta in deltas.items():
        redis_key = f"fantasy:match:{live_key}:player:{player_id}"
        total = await redis.hincrbyfloat(redis_key, "points", delta)
        message = WSMessage(
            event="FANTASY_POINTS_DELTA",
            data={
                "match_id": live_key,
                "player_id": player_id,
                "delta": delta,
                "total_points": float(total),
                "ts": ts,
            },
        )
        await redis.publish(channel, message.model_dump_json())
    return len(deltas)


def _aggregate_match_events(db: Session, live_key: str) -> dict[uuid.UUID, Counter]:
    """Per-player event-type counts from the stored live_events of a match,
    keyed by Sporty player UUID. Events without a valid player id are skipped."""
    rows = (
        db.query(LiveEvent.player_id, LiveEvent.event_type)
        .filter(LiveEvent.match_id == live_key)
        .all()
    )
    per_player: dict[uuid.UUID, Counter] = defaultdict(Counter)
    skipped = 0
    for player_id, event_type in rows:
        try:
            player_uuid = uuid.UUID(player_id)
        except (TypeError, ValueError):
            skipped += 1
            continue
        per_player[player_uuid][event_type] += 1
    if skipped:
        logger.warning(
            "Feed scoring for match %s: %s events skipped (no Sporty player id link)",
            live_key,
            skipped,
        )
    return per_player


def _get_or_create_base_stat(db: Session, player_id: uuid.UUID, window_id: uuid.UUID) -> PlayerGameweekStat:
    stat = (
        db.query(PlayerGameweekStat)
        .filter(
            PlayerGameweekStat.player_id == player_id,
            PlayerGameweekStat.transfer_window_id == window_id,
        )
        .first()
    )
    if stat is None:
        stat = PlayerGameweekStat(player_id=player_id, transfer_window_id=window_id)
        db.add(stat)
        db.flush()
    return stat


def _get_or_create_football_child(db: Session, base_stat: PlayerGameweekStat) -> FootballStat:
    child = db.query(FootballStat).filter(FootballStat.base_stat_id == base_stat.id).first()
    if child is None:
        child = FootballStat(base_stat_id=base_stat.id)
        db.add(child)
        db.flush()
    return child


def _apply_football_counts(db: Session, base_stat: PlayerGameweekStat, counts: Counter) -> None:
    # Assignment, not +=: `counts` is always the FULL recount of this match's
    # live_events (see _aggregate_match_events), so this must be idempotent —
    # persist_match_stats can be called more than once for the same match
    # (see its docstring) and must converge to the same result each time.
    child = _get_or_create_football_child(db, base_stat)
    child.goals = counts.get("goal", 0)
    child.assists = counts.get("assist", 0)
    child.yellow_cards = counts.get("yellow_card", 0)
    child.red_cards = counts.get("red_card", 0)
    # Feeder penalty events (a scored penalty is a plain "goal" and lands
    # above; saves/misses only exist as these dedicated event types).
    child.penalties_saved = counts.get("penalty_saved", 0)
    child.penalties_missed = counts.get("penalty_missed", 0)


def _apply_basketball_counts(db: Session, base_stat: PlayerGameweekStat, counts: Counter) -> None:
    # Assignment, not += — see _apply_football_counts.
    child = db.query(NBAStat).filter(NBAStat.base_stat_id == base_stat.id).first()
    if child is None:
        child = NBAStat(base_stat_id=base_stat.id)
        db.add(child)
        db.flush()
    child.points = (
        counts.get("point_2", 0) * 2 + counts.get("point_3", 0) * 3 + counts.get("free_throw", 0)
    )
    child.assists = counts.get("assist", 0)
    child.rebounds = counts.get("rebound", 0)
    child.steals = counts.get("steal", 0)
    child.blocks = counts.get("block", 0)


def persist_match_stats(db: Session, *, match: Match, live_key: str, sport: str) -> dict:
    """Fold a finished simulated match's events into the gameweek stat tables.

    Idempotent per match: counts are recomputed in full from this match's
    live_events every call and assigned (not accumulated), so it's safe to
    call again for the same match — e.g. if more events arrive after the
    live→finished transition, a later "finished" push re-running this will
    pick them up instead of silently dropping them. The caller owns the
    transaction (no commit here, repo convention).
    """
    per_player = _aggregate_match_events(db, live_key)
    if not per_player:
        logger.info("Feed scoring for match %s: no scorable events", live_key)
        return {"players": 0, "windows": 0}

    window_ids = find_transfer_window_ids_for_datetime(
        db, match_date=match.match_date, sport_id=match.sport_id,
        competition_tag=fantasy_tag_for_competition_name(match.competition),
    )
    if not window_ids:
        logger.warning(
            "Feed scoring for match %s: no transfer window covers %s; stats not booked",
            live_key,
            match.match_date,
        )
        return {"players": 0, "windows": 0}

    # Only book stats for players that exist in this backend (defensive
    # against stale entity links on the feeder side).
    known_player_ids = {
        player_id
        for (player_id,) in db.query(Player.id).filter(Player.id.in_(per_player.keys())).all()
    }
    unknown = set(per_player) - known_player_ids
    if unknown:
        logger.warning(
            "Feed scoring for match %s: %s linked player ids not found in players table",
            live_key,
            len(unknown),
        )

    match_minutes = MATCH_MINUTES.get(sport, 90)
    apply_counts = _apply_basketball_counts if sport == "basketball" else _apply_football_counts

    booked = 0
    for window_id in window_ids:
        for player_id in known_player_ids:
            base_stat = _get_or_create_base_stat(db, player_id, window_id)
            base_stat.minutes_played = match_minutes
            apply_counts(db, base_stat, per_player[player_id])
            booked += 1

    logger.info(
        "Feed scoring for match %s: booked stats for %s players across %s window(s)",
        live_key,
        len(known_player_ids),
        len(window_ids),
    )
    return {"players": len(known_player_ids), "windows": len(window_ids), "stat_rows": booked}


# Full-sheet columns booked from API-Football's /fixtures/players at FT.
# clean_sheets and minutes are derived/read by the parser in
# football_live_sync; own_goals/bonus aren't in the API sheet and stay 0.
FOOTBALL_SHEET_FIELDS = (
    "goals",
    "assists",
    "clean_sheets",
    "yellow_cards",
    "red_cards",
    "penalties_saved",
    "penalties_missed",
    "saves",
    "goals_conceded",
)


def _book_player_match_scores(db, *, match, window_ids, known_player_ids, stats_by_player) -> None:
    """Write a PlayerMatchScore per (player, covering window) for a finished
    match, from the per-match stat sheet. Lazy imports break the
    feed_scoring ↔ player_scoring cycle."""
    from app.services.scoring.player_scoring import load_football_rules
    from app.services.scoring.match_scoring import upsert_player_match_score

    rules = load_football_rules(db, match.sport_id)
    if not rules:
        return
    positions = dict(
        db.query(Player.id, Player.position).filter(Player.id.in_(known_player_ids)).all()
    )
    for window_id in window_ids:
        for player_id in known_player_ids:
            sheet = stats_by_player[player_id]
            stats = {
                "minutes": int(sheet.get("minutes", 0) or 0),
                "goals": int(sheet.get("goals", 0) or 0),
                "assists": int(sheet.get("assists", 0) or 0),
                "clean_sheets": min(1, int(sheet.get("clean_sheets", 0) or 0)),
                "saves": int(sheet.get("saves", 0) or 0),
                "penalties_saved": int(sheet.get("penalties_saved", 0) or 0),
                "penalties_missed": int(sheet.get("penalties_missed", 0) or 0),
                "own_goals": int(sheet.get("own_goals", 0) or 0),
                "goals_conceded": int(sheet.get("goals_conceded", 0) or 0),
                "yellow_cards": min(2, int(sheet.get("yellow_cards", 0) or 0)),
                "red_cards": min(1, int(sheet.get("red_cards", 0) or 0)),
            }
            upsert_player_match_score(
                db, player_id=player_id, match_id=match.id,
                transfer_window_id=window_id, position=positions.get(player_id),
                minutes=stats["minutes"], stats=stats, rules=rules,
            )


def persist_football_stats_from_sheet(
    db: Session, *, match: Match, live_key: str, stats_by_player: dict[uuid.UUID, dict]
) -> dict:
    """Book a finished real-API match's gameweek stats from the full
    /fixtures/players sheet instead of counting live_events — this is what
    fills saves/minutes/clean sheets, which never exist as poll events.

    Same contract as persist_match_stats: assignment (not +=) so re-booking
    the same match converges, and the caller owns the transaction. Values are
    clamped to the FootballStat check constraints (e.g. a data glitch
    reporting 3 yellows must not abort the whole booking commit).
    """
    if not stats_by_player:
        return {"players": 0, "windows": 0}

    window_ids = find_transfer_window_ids_for_datetime(
        db, match_date=match.match_date, sport_id=match.sport_id,
        competition_tag=fantasy_tag_for_competition_name(match.competition),
    )
    if not window_ids:
        logger.warning(
            "Sheet booking for match %s: no transfer window covers %s; stats not booked",
            live_key,
            match.match_date,
        )
        return {"players": 0, "windows": 0}

    known_player_ids = {
        player_id
        for (player_id,) in db.query(Player.id).filter(Player.id.in_(stats_by_player.keys())).all()
    }

    caps = {"yellow_cards": 2, "red_cards": 1, "clean_sheets": 1}
    booked = 0
    for window_id in window_ids:
        for player_id in known_player_ids:
            sheet = stats_by_player[player_id]
            base_stat = _get_or_create_base_stat(db, player_id, window_id)
            base_stat.minutes_played = sheet.get("minutes", 0)
            child = _get_or_create_football_child(db, base_stat)
            for field in FOOTBALL_SHEET_FIELDS:
                value = max(0, int(sheet.get(field, 0) or 0))
                setattr(child, field, min(value, caps.get(field, value)))
            booked += 1

    # Per-match layer (Phase 2): record each player's PlayerMatchScore for this
    # match under every covering window. The window total is aggregated later by
    # the scoring task (score_football_players_for_window), which re-scores from
    # these; here we persist the stats snapshot + an initial score.
    _book_player_match_scores(db, match=match, window_ids=window_ids,
                              known_player_ids=known_player_ids, stats_by_player=stats_by_player)

    logger.info(
        "Sheet booking for match %s: booked stats for %s players across %s window(s)",
        live_key,
        len(known_player_ids),
        len(window_ids),
    )
    return {"players": len(known_player_ids), "windows": len(window_ids), "stat_rows": booked}


# A live feeder match goes quiet when the feeder dies mid-simulation (its
# simulation state is in-memory only, so a restart can't resume or finish it).
# Simulations run ~90 in-game minutes even at slow speeds (plus ET/shootout),
# so anything silent for 1.5 real hours is orphaned.
STALE_LIVE_AFTER = timedelta(minutes=90)


def finalize_stale_live_matches(db: Session, redis) -> dict:
    """Finish matches stuck on status='live' whose feed went silent.

    Runs the same live→finished path as the feed endpoint: mark finished at the
    last known score, fold live_events into the gameweek stat tables, enqueue
    scoring, and publish the final SCORE_UPDATE so open browsers stop showing
    the match as live. Owns its transaction (top-level job entry point);
    commits per match so one bad match can't roll back the others.
    """
    from app.core.config import settings
    from app.league.models import Sport
    # Lazy: scoring_trigger ↔ celery_app ↔ tasks form an import cycle that
    # only resolves when celery_app loads first (same note as feed.py).
    from app.services.scoring.scoring_trigger import enqueue_scoring_for_finished_match

    cutoff = datetime.now(timezone.utc) - STALE_LIVE_AFTER
    stale = (
        db.query(Match)
        .filter(Match.status == "live", Match.updated_at < cutoff)
        .all()
    )
    finalized = 0
    for match in stale:
        live_key = match.external_api_id or str(match.id)
        sport_row = db.query(Sport).filter(Sport.id == match.sport_id).first()
        sport = (sport_row.name if sport_row else "football").lower()
        logger.warning(
            "Stale live match %s (%s vs %s): no feed update since %s, finalizing at %s-%s",
            live_key,
            match.home_team,
            match.away_team,
            match.updated_at,
            match.home_score,
            match.away_score,
        )
        try:
            match.status = "finished"
            persist_match_stats(db, match=match, live_key=live_key, sport=sport)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Stale match %s: finalization failed, skipping", live_key)
            continue
        # Best-effort from here: stats are committed, the daily ranking cron
        # re-scores as fallback, and a lost WS message only affects open tabs.
        try:
            enqueue_scoring_for_finished_match(
                db, match_date=match.match_date, sport_id=match.sport_id
            )
        except Exception:
            logger.exception("Stale match %s: scoring enqueue failed (cron will re-score)", live_key)
        try:
            message = WSMessage(
                event="SCORE_UPDATE",
                data={
                    "kind": "FEED_MATCH_RESULT",
                    "match_id": live_key,
                    "sport": sport,
                    "status": "finished",
                    "home": match.home_score,
                    "away": match.away_score,
                    "minute": MATCH_MINUTES.get(sport, 90),
                    "events": [],
                },
            )
            redis.publish(f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}", message.model_dump_json())
        except Exception:
            logger.exception("Stale match %s: final SCORE_UPDATE publish failed", live_key)
        finalized += 1
    return {"stale": len(stale), "finalized": finalized}
