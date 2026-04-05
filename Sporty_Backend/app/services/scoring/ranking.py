from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.league.models import FantasyTeam, TeamWeeklyScore


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
    ranked = (
        select(
            TeamWeeklyScore.id.label("score_id"),
            func.rank().over(order_by=TeamWeeklyScore.points.desc()).label("computed_rank"),
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
