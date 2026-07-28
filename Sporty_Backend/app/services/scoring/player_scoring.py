from __future__ import annotations

import logging
import random
import time
import uuid
from decimal import Decimal

from sqlalchemy import Numeric, cast, func, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.redis_lock import redis_lock
from app.player.models import CricketStat, FootballStat, Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.scoring.models import DefaultScoringRule
from app.services.scoring.football_engine import Rule, compute_football_score
from app.services.scoring.rules import resolve_effective_rules, to_decimal


logger = logging.getLogger(__name__)

_DEADLOCK_PGCODE = "40P01"
_MAX_ATTEMPTS = 3
_BASE_BACKOFF_SECONDS = 0.25


def _is_deadlock(exc: OperationalError) -> bool:
    return getattr(getattr(exc, "orig", None), "pgcode", None) == _DEADLOCK_PGCODE


def _run_window_write(db: Session, writer, *, sport_id: uuid.UUID, transfer_window_id: uuid.UUID):
    """Run `writer()` under the (sport, window)-scoped Redis lock + SAVEPOINT
    with deadlock retry — the shared write discipline for player_gameweek_stats
    (see the long note in _execute_window_stat_update, which now delegates
    here). `writer` is any callable that performs the write and returns a value.
    """
    lock_key = f"lock:score:stats:{sport_id}:{transfer_window_id}"
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        with redis_lock(lock_key, ttl_seconds=30, wait_seconds=10) as acquired:
            if not acquired:
                if attempt == _MAX_ATTEMPTS:
                    raise RuntimeError(
                        f"Could not acquire scoring lock for sport={sport_id} window={transfer_window_id}"
                    )
                time.sleep(_BASE_BACKOFF_SECONDS * attempt)
                continue
            try:
                with db.begin_nested():
                    return writer()
            except OperationalError as exc:
                if not _is_deadlock(exc) or attempt == _MAX_ATTEMPTS:
                    raise
                delay = _BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.1)
                logger.warning(
                    "Deadlock scoring sport=%s window=%s, retrying (attempt %d/%d) in %.2fs",
                    sport_id, transfer_window_id, attempt, _MAX_ATTEMPTS, delay,
                )
                time.sleep(delay)
    raise RuntimeError("unreachable")


def _execute_window_stat_update(db: Session, stmt, *, sport_id: uuid.UUID, transfer_window_id: uuid.UUID):
    # The same (sport, window) player_gameweek_stats rows can be targeted at
    # once by the Beat-scheduled active-window sweep and the ad-hoc
    # match-finish trigger — serialize + deadlock-retry the write (see
    # _run_window_write). Thin wrapper kept for the cricket/NBA bulk-SQL path.
    return _run_window_write(
        db, lambda: db.execute(stmt),
        sport_id=sport_id, transfer_window_id=transfer_window_id,
    )


FOOTBALL_ACTIONS = {
    "football_goal": Decimal("5"),
    "football_assist": Decimal("3"),
    "football_yellow_card": Decimal("-1"),
    "football_red_card": Decimal("-2"),
}

CRICKET_ACTIONS = [
    "cricket_run",
    "cricket_wicket",
    "cricket_catch",
    "cricket_run_out",
    "cricket_maiden",
]

NBA_ACTIONS = [
    "nba_points_10",
    "nba_assists_10",
    "nba_rebound",
    "nba_steal",
    "nba_block",
]


def compute_nba_fantasy_points(
    *,
    points: int | None,
    assists: int | None,
    rebounds: int | None,
    steals: int | None,
    blocks: int | None,
    nba_points_10: Decimal,
    nba_assists_10: Decimal,
    nba_rebound: Decimal,
    nba_steal: Decimal,
    nba_block: Decimal,
) -> Decimal:
    # Algorithm: (points/10)*nba_points_10 + (assists/10)*nba_assists_10 + rebounds*nba_rebound + steals*nba_steal + blocks*nba_block.
    points_d = to_decimal(points)
    assists_d = to_decimal(assists)
    rebounds_d = to_decimal(rebounds)
    steals_d = to_decimal(steals)
    blocks_d = to_decimal(blocks)
    return (
        ((points_d / Decimal("10")) * nba_points_10)
        + ((assists_d / Decimal("10")) * nba_assists_10)
        + (rebounds_d * nba_rebound)
        + (steals_d * nba_steal)
        + (blocks_d * nba_block)
    )


def load_football_rules(db: Session, sport_id: uuid.UUID) -> list[Rule]:
    """The football sport's full DB rule set as engine Rule objects."""
    rows = (
        db.query(
            DefaultScoringRule.action,
            DefaultScoringRule.position,
            DefaultScoringRule.mode,
            DefaultScoringRule.param,
            DefaultScoringRule.points,
        )
        .filter(DefaultScoringRule.sport_id == sport_id)
        .all()
    )
    return [
        Rule(action=a, position=p, mode=m,
             param=(to_decimal(param) if param is not None else None),
             points=to_decimal(pts))
        for a, p, m, param, pts in rows
    ]


def _football_stats_dict(minutes: int, fs: FootballStat) -> dict:
    """Flatten a FootballStat (+ minutes) into the metric dict the engine reads.
    getattr with default keeps this working before the advanced columns exist."""
    return {
        "minutes": minutes or 0,
        "goals": fs.goals, "assists": fs.assists, "clean_sheets": fs.clean_sheets,
        "saves": fs.saves, "penalties_saved": fs.penalties_saved,
        "penalties_missed": fs.penalties_missed, "own_goals": fs.own_goals,
        "goals_conceded": fs.goals_conceded, "yellow_cards": fs.yellow_cards,
        "red_cards": fs.red_cards,
        "tackles": getattr(fs, "tackles", 0) or 0,
        "interceptions": getattr(fs, "interceptions", 0) or 0,
        "blocks": getattr(fs, "blocks", 0) or 0,
        "clearances": getattr(fs, "clearances", 0) or 0,
        "key_passes": getattr(fs, "key_passes", 0) or 0,
        "shots_on_target": getattr(fs, "shots_on_target", 0) or 0,
        "dribbles_won": getattr(fs, "dribbles_won", 0) or 0,
        "duels_won": getattr(fs, "duels_won", 0) or 0,
    }


def score_football_players_for_window(
    db: Session,
    *,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    """Position-aware, config-driven gameweek scoring for football.

    Interprets the DB rule set per player (appearance, position goals, clean
    sheets, saves, pen save/miss, own goals, conceded, cards, defensive
    contribution) and writes fantasy_points + an explainable breakdown. Falls
    back to a no-op if no rules are seeded (never silently zeroes existing
    scores). Replaces the old goals/assists/cards-only bulk UPDATE.
    """
    rules = load_football_rules(db, sport_id)
    if not rules:
        logger.warning("No football scoring rules seeded for sport=%s — skipping", sport_id)
        return 0

    # Per-match layer (Phase 2): re-score stored match rows with the current
    # rules and get each player's window total = SUM of their matches. Authoritative
    # when present; a row with only a window-aggregate FootballStat (and no match
    # rows) falls back to computing from that.
    from app.services.scoring.match_scoring import rescore_window_match_scores
    match_agg = rescore_window_match_scores(db, transfer_window_id=transfer_window_id, rules=rules)

    rows = (
        db.query(
            PlayerGameweekStat.id,
            PlayerGameweekStat.player_id,
            PlayerGameweekStat.minutes_played,
            FootballStat,
            Player.position,
        )
        .join(FootballStat, FootballStat.base_stat_id == PlayerGameweekStat.id)
        .join(Player, Player.id == PlayerGameweekStat.player_id)
        .filter(
            PlayerGameweekStat.transfer_window_id == transfer_window_id,
            Player.sport_id == sport_id,
        )
        .all()
    )
    if not rows:
        return 0

    updates = []
    for pgs_id, player_id, minutes, fs, position in rows:
        if player_id in match_agg:
            total, breakdown = match_agg[player_id]
        else:
            total, breakdown = compute_football_score(
                position, _football_stats_dict(minutes, fs), rules
            )
        updates.append({"id": pgs_id, "fantasy_points": total, "breakdown": breakdown})

    _run_window_write(
        db, lambda: db.bulk_update_mappings(PlayerGameweekStat, updates),
        sport_id=sport_id, transfer_window_id=transfer_window_id,
    )
    return len(updates)


def score_cricket_players_for_window(
    db: Session,
    *,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    # Algorithm: update player_gameweek_stats fantasy_points using cricket child stats with coalesce and default run/wicket/catch/run_out/maiden rules.
    rules = resolve_effective_rules(
        db,
        sport_id=sport_id,
        actions=CRICKET_ACTIONS,
    )

    pgs = PlayerGameweekStat.__table__
    stats = CricketStat.__table__
    players = Player.__table__

    stmt = (
        update(pgs)
        .where(pgs.c.id == stats.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                (func.coalesce(stats.c.runs_scored, 0) * rules.points_by_action["cricket_run"])
                + (func.coalesce(stats.c.wickets_taken, 0) * rules.points_by_action["cricket_wicket"])
                + (func.coalesce(stats.c.catches, 0) * rules.points_by_action["cricket_catch"])
                + (func.coalesce(stats.c.run_outs, 0) * rules.points_by_action["cricket_run_out"])
                + (func.coalesce(stats.c.maidens, 0) * rules.points_by_action["cricket_maiden"])
            )
        )
        .execution_options(synchronize_session=False)
    )
    result = _execute_window_stat_update(db, stmt, sport_id=sport_id, transfer_window_id=transfer_window_id)
    return int(result.rowcount or 0)


def score_nba_players_for_window(
    db: Session,
    *,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    # Algorithm: update player_gameweek_stats fantasy_points using NBA fractional per-10 rules for points/assists and per-unit for rebounds/steals/blocks.
    rules = resolve_effective_rules(
        db,
        sport_id=sport_id,
        actions=NBA_ACTIONS,
    )

    pgs = PlayerGameweekStat.__table__
    stats = NBAStat.__table__
    players = Player.__table__

    points_num = cast(func.coalesce(stats.c.points, 0), Numeric)
    assists_num = cast(func.coalesce(stats.c.assists, 0), Numeric)

    stmt = (
        update(pgs)
        .where(pgs.c.id == stats.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                ((points_num / 10) * rules.points_by_action["nba_points_10"])
                + ((assists_num / 10) * rules.points_by_action["nba_assists_10"])
                + (func.coalesce(stats.c.rebounds, 0) * rules.points_by_action["nba_rebound"])
                + (func.coalesce(stats.c.steals, 0) * rules.points_by_action["nba_steal"])
                + (func.coalesce(stats.c.blocks, 0) * rules.points_by_action["nba_block"])
            )
        )
        .execution_options(synchronize_session=False)
    )
    result = _execute_window_stat_update(db, stmt, sport_id=sport_id, transfer_window_id=transfer_window_id)
    return int(result.rowcount or 0)
