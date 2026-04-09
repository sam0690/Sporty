from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, aliased

from app.league.models import (
    FantasyTeam,
    LeagueMembership,
    TeamGameweekLineup,
    TeamWeeklyScore,
    TransferWindow,
)
from app.player.models import PlayerGameweekStat


def apply_captain_vice_bonus(
    *,
    base_points: Decimal,
    captain_points: Decimal | None,
    captain_minutes: int | None,
    vice_points: Decimal | None,
    vice_minutes: int | None,
) -> Decimal:
    # Algorithm: if captain played add captain points; else if captain DNP and vice played add vice points; else add 0.
    if captain_points is not None and (captain_minutes or 0) > 0:
        return base_points + captain_points
    if (captain_minutes or 0) == 0 and vice_points is not None and (vice_minutes or 0) > 0:
        return base_points + vice_points
    return base_points


def upsert_team_weekly_scores(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    # Algorithm: aggregate lineup+player stats in SQL for each team, apply captain/vice rule in SQL CASE expression, then upsert team_weekly_scores.
    current_window_number = (
        db.query(TransferWindow.number)
        .filter(TransferWindow.id == transfer_window_id)
        .scalar()
    )
    if current_window_number is None:
        return 0

    eligibility_window = aliased(TransferWindow)
    teams_subquery = (
        select(FantasyTeam.id.label("fantasy_team_id"))
        .join(
            LeagueMembership,
            and_(
                LeagueMembership.league_id == FantasyTeam.league_id,
                LeagueMembership.user_id == FantasyTeam.user_id,
            ),
        )
        .outerjoin(
            eligibility_window,
            LeagueMembership.eligible_from_window_id == eligibility_window.id,
        )
        .where(FantasyTeam.league_id == league_id)
        .where(
            or_(
                LeagueMembership.eligible_from_window_id.is_(None),
                eligibility_window.number <= current_window_number,
            )
        )
        .subquery()
    )

    lineup_stats_subquery = (
        select(
            TeamGameweekLineup.fantasy_team_id.label("fantasy_team_id"),
            func.coalesce(PlayerGameweekStat.fantasy_points, Decimal("0")).label("player_points"),
            func.coalesce(PlayerGameweekStat.minutes_played, 0).label("minutes_played"),
            TeamGameweekLineup.is_captain.label("is_captain"),
            TeamGameweekLineup.is_vice_captain.label("is_vice_captain"),
        )
        .outerjoin(
            PlayerGameweekStat,
            and_(
                PlayerGameweekStat.player_id == TeamGameweekLineup.player_id,
                PlayerGameweekStat.transfer_window_id == TeamGameweekLineup.transfer_window_id,
            ),
        )
        .where(TeamGameweekLineup.transfer_window_id == transfer_window_id)
        .subquery()
    )

    aggregated_subquery = (
        select(
            teams_subquery.c.fantasy_team_id,
            func.coalesce(func.sum(lineup_stats_subquery.c.player_points), Decimal("0")).label("base_points"),
            func.max(
                case(
                    (lineup_stats_subquery.c.is_captain.is_(True), lineup_stats_subquery.c.player_points),
                    else_=None,
                )
            ).label("captain_points"),
            func.max(
                case(
                    (lineup_stats_subquery.c.is_captain.is_(True), lineup_stats_subquery.c.minutes_played),
                    else_=0,
                )
            ).label("captain_minutes"),
            func.max(
                case(
                    (lineup_stats_subquery.c.is_vice_captain.is_(True), lineup_stats_subquery.c.player_points),
                    else_=None,
                )
            ).label("vice_points"),
            func.max(
                case(
                    (lineup_stats_subquery.c.is_vice_captain.is_(True), lineup_stats_subquery.c.minutes_played),
                    else_=0,
                )
            ).label("vice_minutes"),
        )
        .select_from(teams_subquery)
        .outerjoin(
            lineup_stats_subquery,
            lineup_stats_subquery.c.fantasy_team_id == teams_subquery.c.fantasy_team_id,
        )
        .group_by(teams_subquery.c.fantasy_team_id)
        .subquery()
    )

    final_points_expr = (
        aggregated_subquery.c.base_points
        + case(
            (
                aggregated_subquery.c.captain_minutes > 0,
                func.coalesce(aggregated_subquery.c.captain_points, Decimal("0")),
            ),
            (
                and_(
                    func.coalesce(aggregated_subquery.c.captain_minutes, 0) == 0,
                    aggregated_subquery.c.vice_minutes > 0,
                ),
                func.coalesce(aggregated_subquery.c.vice_points, Decimal("0")),
            ),
            else_=Decimal("0"),
        )
    )

    final_rows = db.execute(
        select(
            aggregated_subquery.c.fantasy_team_id,
            final_points_expr.label("final_points"),
        )
    ).all()

    if not final_rows:
        return 0

    values = [
        {
            "id": uuid.uuid4(),
            "fantasy_team_id": fantasy_team_id,
            "transfer_window_id": transfer_window_id,
            "points": final_points,
            "rank_in_league": None,
        }
        for fantasy_team_id, final_points in final_rows
    ]

    insert_stmt = insert(TeamWeeklyScore).values(values)

    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=[TeamWeeklyScore.fantasy_team_id, TeamWeeklyScore.transfer_window_id],
        set_={
            "points": insert_stmt.excluded.points,
            "rank_in_league": None,
        },
    )

    result = db.execute(upsert_stmt)
    return int(result.rowcount or 0)
