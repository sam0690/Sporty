from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.league.models import FantasyTeam, PointsPenalty, TeamWeeklyScore

logger = logging.getLogger(__name__)


def compute_rank_map(points_rows: list[tuple[uuid.UUID, Decimal]]) -> dict[uuid.UUID, int]:
    # Algorithm: sort by points desc then team id asc and assign SQL RANK semantics where ties share rank and next rank skips.
    ordered = sorted(points_rows, key=lambda item: (-item[1], str(item[0])))
    rank_map: dict[uuid.UUID, int] = {}
    prev_points: Decimal | None = None
    current_rank = 0

    for index, (team_id, points) in enumerate(ordered, start=1):
        if prev_points is None or points != prev_points:
            current_rank = index
            prev_points = points
        rank_map[team_id] = current_rank

    return rank_map


def apply_rankings_for_league_window(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    # Algorithm: compute rank_in_league with SQL RANK() OVER (ORDER BY points DESC) and update rows via UPDATE ... FROM ranked subquery.
    #
    # Net out budget-overage points penalties before ranking — same principle
    # as get_league_leaderboard() in app/league/services.py: the raw
    # TeamWeeklyScore.points column stays untouched (freely overwritten by
    # the scoring engine on every rerun), the penalty only affects the
    # read-time rank a team is credited.
    penalty = (
        select(func.coalesce(func.sum(PointsPenalty.points_charged), 0))
        .where(
            PointsPenalty.fantasy_team_id == TeamWeeklyScore.fantasy_team_id,
            PointsPenalty.transfer_window_id == TeamWeeklyScore.transfer_window_id,
        )
        .correlate(TeamWeeklyScore)
        .scalar_subquery()
    )
    ranked = (
        select(
            TeamWeeklyScore.id.label("score_id"),
            func.rank().over(order_by=(TeamWeeklyScore.points - penalty).desc()).label("computed_rank"),
        )
        .join(FantasyTeam, FantasyTeam.id == TeamWeeklyScore.fantasy_team_id)
        .where(FantasyTeam.league_id == league_id)
        .where(TeamWeeklyScore.transfer_window_id == transfer_window_id)
        .subquery()
    )

    stmt = (
        update(TeamWeeklyScore)
        .where(TeamWeeklyScore.id == ranked.c.score_id)
        .values(rank_in_league=ranked.c.computed_rank)
        .execution_options(synchronize_session=False)
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def compute_and_store_rankings(window_id: uuid.UUID, db: Session) -> None:
    """Compute and persist rank_in_league for every team in the given transfer window.

    Finds all leagues that have TeamWeeklyScore rows for window_id, then issues
    a single bulk UPDATE per league via apply_rankings_for_league_window.
    Idempotent — safe to re-run for the same window.  No-op if no scores exist.
    """
    league_ids = (
        db.execute(
            select(FantasyTeam.league_id)
            .join(TeamWeeklyScore, TeamWeeklyScore.fantasy_team_id == FantasyTeam.id)
            .where(TeamWeeklyScore.transfer_window_id == window_id)
            .distinct()
        )
        .scalars()
        .all()
    )

    if not league_ids:
        logger.info("compute_and_store_rankings: no scores found for window %s, skipping", window_id)
        return

    from app.league import read_cache

    total_updated = 0
    for league_id in league_ids:
        total_updated += apply_rankings_for_league_window(
            db, league_id=league_id, transfer_window_id=window_id
        )
        # New ranks/points persisted for this league — drop its cached
        # leaderboard + power-rankings so the change shows immediately rather
        # than waiting out the TTL.
        read_cache.bust_league(league_id)

    logger.info(
        "compute_and_store_rankings: window=%s leagues=%d rows_updated=%d",
        window_id,
        len(league_ids),
        total_updated,
    )
