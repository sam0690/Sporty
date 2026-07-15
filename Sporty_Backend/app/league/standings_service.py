"""Leaderboards and gameweek recaps.

Split from the former 3,972-line app/league/services.py; that module is now a
facade re-exporting every name, so external imports keep working unchanged.
"""

import json
import logging
import random
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased, joinedload, selectinload, with_loader_criteria
from app.auth.models import User
from app.league.models import (
    BudgetTransaction,
    DraftPick,
    FantasyTeam,
    FantasyTeamStatus,
    PointsPenalty,
    RosterMove,
    TeamGameweekLineup,
    TransferWindow,
    League,
    LeagueMembership,
    LeagueMembershipStatus,
    LeagueStatus,
    LeagueSport,
    LineupSlot,
    Season,
    Sport,
    TeamPlayer,
    Transfer,
    TeamWeeklyScore,
)
from app.league.schemas import LeagueCreate, LineupSlotCreate
from app.league.sportConfigs import derive_sport_type, get_squad_size
from app.player.models import Player, PlayerGameweekStat
from app.core.redis import get_redis
from app.services.budget_utils import calculate_refund
from app.services.scoring.window_locator import find_equivalent_season_for_sport
from app.core.config import settings
from app.squad.services import (
    check_squad_constraints,
    validate_lineup_for_league_type,
    validate_position_slots,
    validate_squad_size,
)
from app.league.service_helpers import _require_fantasy_team, _require_league

logger = logging.getLogger(__name__)




def get_gameweek_recap(
    db: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
    window_id: uuid.UUID | None = None,
    gameweek: int | None = None,
) -> dict:
    """Return the user's team for a scored gameweek with a per-player points
    breakdown — who started, who was benched, who was auto-subbed in/out, and
    how many points each player contributed (including the captain/vice bonus).

    The window is resolved by ``window_id`` if given, else by ``gameweek`` number
    within the league's season, else the most recently scored window for this
    team (falling back to the latest window in the league's season)."""
    from app.services.optimization.hindsight_service import compute_hindsight_lineup
    from app.services.scoring.team_scoring import (
        load_slot_bounds,
        load_team_lineup_rows,
        resolve_team_gameweek,
    )

    team = _require_fantasy_team(db, league_id, user_id)
    league = _require_league(db, league_id)

    if window_id is not None:
        window = (
            db.query(TransferWindow)
            .filter(TransferWindow.id == window_id)
            .first()
        )
        if window is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer window not found",
            )
    elif gameweek is not None:
        window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                TransferWindow.number == gameweek,
            )
            .first()
        )
        if window is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Gameweek {gameweek} not found",
            )
    else:
        # Most recent window this team has a persisted score for.
        window = (
            db.query(TransferWindow)
            .join(
                TeamWeeklyScore,
                TeamWeeklyScore.transfer_window_id == TransferWindow.id,
            )
            .filter(TeamWeeklyScore.fantasy_team_id == team.id)
            .order_by(TransferWindow.number.desc())
            .first()
        )
        if window is None:
            # No persisted score yet for this team/league — fall back to the
            # most recent window that has actually ended, never an upcoming
            # one, so we don't report "did not play" for a gameweek that
            # hasn't been played yet.
            window = (
                db.query(TransferWindow)
                .filter(
                    TransferWindow.season_id == league.season_id,
                    TransferWindow.end_at <= func.now(),
                )
                .order_by(TransferWindow.number.desc())
                .first()
            )
    if window is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No gameweek available for this league yet",
        )

    # "Played" once the gameweek has STARTED (lineups lock start_at+1min, see
    # scripts/reanchor_transfer_window_deadlines.py), not once it has fully
    # ENDED — matches happen throughout the week, so this should read as a
    # live, filling-in-as-it-goes recap (like real FPL), not a locked
    # "not yet played" placeholder for the entire gameweek's duration.
    window_has_played = window.start_at <= datetime.now(timezone.utc)

    slot_bounds = load_slot_bounds(db, league_id)
    rows = load_team_lineup_rows(
        db, team_ids=[team.id], transfer_window_id=window.id
    ).get(team.id, [])
    result = (
        resolve_team_gameweek(
            team.id, rows, slot_bounds, window_has_played=window_has_played
        )
        if rows
        else None
    )

    player_ids = [r.player_id for r in rows]
    players_by_id = {
        p.id: p
        for p in (
            db.query(Player)
            .options(joinedload(Player.sport))
            .filter(Player.id.in_(player_ids))
            .all()
            if player_ids
            else []
        )
    }

    stored = (
        db.query(TeamWeeklyScore)
        .filter(
            TeamWeeklyScore.fantasy_team_id == team.id,
            TeamWeeklyScore.transfer_window_id == window.id,
        )
        .first()
    )

    player_lines: list[dict] = []
    if result is not None:
        for line in result.players:
            player = players_by_id.get(line.player_id)
            if player is None:
                continue  # player deleted — skip gracefully
            contributed = (
                (line.points if line.counted else Decimal("0")) + line.captain_bonus
            )
            player_lines.append(
                {
                    "player": player,
                    "is_starter": line.is_starter,
                    "is_captain": line.is_captain,
                    "is_vice_captain": line.is_vice_captain,
                    "bench_order": line.bench_order,
                    "minutes_played": line.minutes_played,
                    "points": line.points,
                    "captain_bonus": line.captain_bonus,
                    "counted": line.counted,
                    "status": line.status,
                    "contributed_points": contributed,
                }
            )

    # Starters first (highest contribution on top), then bench in sub-priority.
    player_lines.sort(
        key=lambda x: (
            0 if x["is_starter"] else 1,
            x["bench_order"] if x["bench_order"] is not None else -1,
            -float(x["contributed_points"]),
        )
    )

    total = result.total_points if result else (stored.points if stored else Decimal("0"))
    base = result.base_points if result else Decimal("0")
    bonus = result.captain_vice_bonus if result else Decimal("0")

    # "Beat the Optimizer" — how close was the actual lineup to the best
    # possible one, in hindsight? Only meaningful once the window has
    # actually played; never lets a computation failure break the recap.
    hindsight = None
    if window_has_played and rows:
        hindsight = compute_hindsight_lineup(
            rows=rows,
            players_by_id=players_by_id,
            slot_bounds=slot_bounds,
            actual_total_points=total,
        )

    return {
        "fantasy_team_id": team.id,
        "team_name": team.name,
        "transfer_window_id": window.id,
        "gameweek_number": window.number,
        "total_points": total,
        "base_points": base,
        "captain_vice_bonus": bonus,
        "rank_in_league": stored.rank_in_league if stored else None,
        "players": player_lines,
        "best_possible_points": hindsight.best_possible_points if hindsight else None,
        "capture_rate": hindsight.capture_rate if hindsight else None,
    }



def get_league_leaderboard(
    db: Session,
    league_id: uuid.UUID,
    window_id: uuid.UUID | None = None,
    historical: bool = True,
    gameweek: int | None = None,
) -> dict:
    """Return the leaderboard for a league.

    historical=True includes both ACTIVE and LEFT memberships so final and
    historical standings preserve departed users.
    historical=False returns the live leaderboard for active members only.

    A specific gameweek can be requested either by window_id (UUID) directly or
    by gameweek number (resolved to the league season's window here, so callers
    don't need to know window UUIDs). window_id takes precedence if both given.
    """
    from app.league.models import FantasyTeam, TeamWeeklyScore
    from app.auth.models import User

    # Resolve a gameweek number to its window for this league's season.
    if window_id is None and gameweek is not None:
        league = _require_league(db, league_id)
        resolved = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                TransferWindow.number == gameweek,
            )
            .first()
            if league.season_id
            else None
        )
        if not resolved:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Gameweek {gameweek} not found for this league",
            )
        window_id = resolved.id

    eligibility_window = aliased(TransferWindow)
    
    if window_id:
        requested_window = (
            db.query(TransferWindow)
            .filter(TransferWindow.id == window_id)
            .first()
        )
        if not requested_window:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer window not found",
            )

        # 1. Standing for a specific window
        #
        # Net out any budget-overage points penalties for this window — the
        # raw TeamWeeklyScore.points stays untouched (the scoring engine
        # freely overwrites it), the penalty is applied here at read time.
        # rank_in_league is precomputed by ranking.py, which nets the same
        # penalties out before ranking, so the two stay consistent.
        window_penalty = (
            select(func.coalesce(func.sum(PointsPenalty.points_charged), 0))
            .where(
                PointsPenalty.fantasy_team_id == FantasyTeam.id,
                PointsPenalty.transfer_window_id == window_id,
            )
            .correlate(FantasyTeam)
            .scalar_subquery()
        )
        window_penalty_display = (
            select(func.coalesce(func.sum(PointsPenalty.points_charged), 0))
            .where(
                PointsPenalty.fantasy_team_id == FantasyTeam.id,
                PointsPenalty.transfer_window_id == window_id,
            )
            .correlate(FantasyTeam)
            .scalar_subquery()
        )
        query = (
            db.query(
                FantasyTeam.id.label("team_id"),
                FantasyTeam.name.label("team_name"),
                User.username.label("owner_name"),
                (TeamWeeklyScore.points - window_penalty).label("points"),
                window_penalty_display.label("points_deducted"),
                TeamWeeklyScore.rank_in_league.label("rank"),
            )
            .select_from(TeamWeeklyScore)
            .join(FantasyTeam, TeamWeeklyScore.fantasy_team_id == FantasyTeam.id)
            .join(User, FantasyTeam.user_id == User.id)
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
            .filter(FantasyTeam.league_id == league_id)
            .filter(
                LeagueMembership.status == LeagueMembershipStatus.ACTIVE
                if not historical
                else LeagueMembership.status.in_(
                    [LeagueMembershipStatus.ACTIVE, LeagueMembershipStatus.LEFT]
                )
            )
            .filter(TeamWeeklyScore.transfer_window_id == window_id)
            .filter(
                or_(
                    LeagueMembership.eligible_from_window_id.is_(None),
                    eligibility_window.number <= requested_window.number,
                )
            )
            .order_by(TeamWeeklyScore.rank_in_league.asc(), TeamWeeklyScore.points.desc())
        )
    else:
        # 2. Total season standing (sum of points)
        now = datetime.now(timezone.utc)
        score_window = aliased(TransferWindow)
        raw_total_points = func.coalesce(func.sum(TeamWeeklyScore.points), 0)
        # Season-wide penalty total (all windows), netted out at read time —
        # see the window-specific branch above for why this doesn't touch
        # TeamWeeklyScore.points directly.
        season_penalty = (
            select(func.coalesce(func.sum(PointsPenalty.points_charged), 0))
            .where(PointsPenalty.fantasy_team_id == FantasyTeam.id)
            .correlate(FantasyTeam)
            .scalar_subquery()
        )
        season_penalty_display = (
            select(func.coalesce(func.sum(PointsPenalty.points_charged), 0))
            .where(PointsPenalty.fantasy_team_id == FantasyTeam.id)
            .correlate(FantasyTeam)
            .scalar_subquery()
        )
        net_total_points = raw_total_points - season_penalty
        query = (
            db.query(
                FantasyTeam.id.label("team_id"),
                FantasyTeam.name.label("team_name"),
                User.username.label("owner_name"),
                net_total_points.label("points"),
                season_penalty_display.label("points_deducted"),
            )
            .join(User, FantasyTeam.user_id == User.id)
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
            .outerjoin(TeamWeeklyScore, TeamWeeklyScore.fantasy_team_id == FantasyTeam.id)
            .outerjoin(score_window, TeamWeeklyScore.transfer_window_id == score_window.id)
            .filter(FantasyTeam.league_id == league_id)
            .filter(
                LeagueMembership.status == LeagueMembershipStatus.ACTIVE
                if not historical
                else LeagueMembership.status.in_(
                    [LeagueMembershipStatus.ACTIVE, LeagueMembershipStatus.LEFT]
                )
            )
            .filter(
                or_(
                    LeagueMembership.eligible_from_window_id.is_(None),
                    eligibility_window.start_at <= now,
                )
            )
            .filter(
                or_(
                    TeamWeeklyScore.id.is_(None),
                    LeagueMembership.eligible_from_window_id.is_(None),
                    score_window.number >= eligibility_window.number,
                )
            )
            .group_by(FantasyTeam.id, User.username)
            .order_by(net_total_points.desc())
        )
    
    results = query.all()

    team_ids = [row.team_id for row in results]
    penalties_by_team: dict[uuid.UUID, list[dict]] = {}
    if team_ids:
        penalty_query = db.query(
            PointsPenalty.fantasy_team_id,
            PointsPenalty.points_charged,
            PointsPenalty.reason,
            PointsPenalty.created_at,
        ).filter(PointsPenalty.fantasy_team_id.in_(team_ids))
        if window_id:
            penalty_query = penalty_query.filter(PointsPenalty.transfer_window_id == window_id)
        for p in penalty_query.order_by(PointsPenalty.created_at.asc()).all():
            penalties_by_team.setdefault(p.fantasy_team_id, []).append({
                "points_charged": p.points_charged,
                "reason": p.reason,
                "created_at": p.created_at,
            })

    entries = []
    for i, row in enumerate(results):
        rank = getattr(row, "rank", None) if window_id else (i + 1)
        entries.append({
            "team_id": row.team_id,
            "team_name": row.team_name,
            "owner_name": row.owner_name,
            "points": row.points,
            "points_deducted": row.points_deducted,
            "penalties": penalties_by_team.get(row.team_id, []),
            "rank": rank,
        })

    return {
        "league_id": league_id,
        "transfer_window_id": window_id,
        "entries": entries,
    }
