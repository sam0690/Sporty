"""Weekly lineups and the user's team view — lineup payloads, updates, player points attachment.

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
    LeagueMembership,
    LeagueMembershipStatus,
    LeagueStatus,
    LeagueSport,
    LineupSlot,
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
from app.services.scoring.window_locator import (
    find_equivalent_season_for_sport,
    league_competition_filter,
)
from app.core.config import settings
from app.squad.services import (
    check_squad_constraints,
    validate_lineup_for_league_type,
    validate_position_slots,
    validate_squad_size,
)
from app.league.service_helpers import _editable_transfer_window, _find_editable_transfer_window, _find_transfer_window, _require_fantasy_team, _require_league, _require_membership, _window_competition_clause

logger = logging.getLogger(__name__)




def get_user_team(
    db: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
) -> FantasyTeam:
    """Return the current user's fantasy team in a league.

    Used by GET /leagues/{league_id}/my-team.
    """
    _require_membership(db, league_id, user_id)

    team = (
        db.query(FantasyTeam)
        .options(
            joinedload(FantasyTeam.user),
            selectinload(FantasyTeam.team_players)
            .joinedload(TeamPlayer.player)
            .joinedload(Player.sport),
            with_loader_criteria(
                TeamPlayer,
                TeamPlayer.released_window_id.is_(None),
                include_aliases=True,
            ),
        )
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == user_id,
        )
        .first()
    )
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You don't have a fantasy team in this league",
        )

    _attach_player_points(db, league_id, team)
    return team



def _attach_player_points(
    db: Session,
    league_id: uuid.UUID,
    team: FantasyTeam,
) -> None:
    """Attach per-player points onto each roster entry for the my-team view.

    Sets transient `total_points`, `avg_points`, and `gameweek_points` on every
    active TeamPlayer (read by TeamPlayerResponse via from_attributes). Points
    come from PlayerGameweekStat.fantasy_points:
      - total_points   = sum of a player's fantasy points across season windows
      - avg_points     = total / number of gameweeks the player was scored in
      - gameweek_points = the active window's points (0 if no active window)

    A multisport league's season_id is only ONE of its sports' schedules — so
    for players of the league's OTHER sports, resolve THAT sport's own
    equivalent season (see find_equivalent_season_for_sport) rather than
    filtering everyone by the league's single season_id, which would leave
    those players' points permanently invisible here.

    A player's fantasy points are season-wide (they don't depend on which team
    owns them), so this is whole-season haul, not points-while-owned. One pair
    of grouped queries per sport present on the roster (at most a handful).
    Read helper — does not mutate the DB.
    """
    rows = list(team.team_players or [])
    for team_player in rows:
        team_player.total_points = Decimal("0")
        team_player.avg_points = Decimal("0")
        team_player.gameweek_points = Decimal("0")
        team_player.gameweek_breakdown = None

    if not rows:
        return

    player_ids = [team_player.player_id for team_player in rows]

    player_sport_map = dict(
        db.query(Player.id, Player.sport_id).filter(Player.id.in_(player_ids)).all()
    )
    roster_sport_ids = set(player_sport_map.values())
    sport_season_ids: dict[uuid.UUID, uuid.UUID] = {}
    for sport_id in roster_sport_ids:
        equivalent_season = find_equivalent_season_for_sport(
            db, league_id=league_id, sport_id=sport_id
        )
        if equivalent_season is not None:
            sport_season_ids[sport_id] = equivalent_season.id

    totals_by_player: dict[uuid.UUID, tuple[Decimal, int]] = {}
    gameweek_by_player: dict[uuid.UUID, Decimal] = {}
    gameweek_breakdown_by_player: dict[uuid.UUID, list] = {}
    now = datetime.now(timezone.utc)

    for sport_id, this_season_id in sport_season_ids.items():
        sport_player_ids = [
            pid for pid in player_ids if player_sport_map.get(pid) == sport_id
        ]
        if not sport_player_ids:
            continue

        # A football season carries several overlapping window schedules (one
        # per competition + the combined NULL one) and a match books its stats
        # into BOTH its competition's window and the combined window. Confine
        # every read to the league's own schedule, or each haul is counted once
        # per schedule the player appears in.
        comp_clause = _window_competition_clause(
            league_competition_filter(db, league_id=league_id, sport_id=sport_id)
        )

        # Season total + gameweeks-scored per player, in one grouped query.
        season_rows = (
            db.query(
                PlayerGameweekStat.player_id.label("player_id"),
                func.coalesce(func.sum(PlayerGameweekStat.fantasy_points), 0).label(
                    "total"
                ),
                func.count(PlayerGameweekStat.id).label("gameweeks"),
            )
            .join(
                TransferWindow,
                TransferWindow.id == PlayerGameweekStat.transfer_window_id,
            )
            .filter(
                TransferWindow.season_id == this_season_id,
                comp_clause,
                PlayerGameweekStat.player_id.in_(sport_player_ids),
            )
            .group_by(PlayerGameweekStat.player_id)
            .all()
        )
        for row in season_rows:
            totals_by_player[row.player_id] = (Decimal(row.total), int(row.gameweeks))

        # This sport's active window's points per player ("this gameweek").
        active_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == this_season_id,
                comp_clause,
                TransferWindow.start_at <= now,
                TransferWindow.end_at >= now,
            )
            .order_by(TransferWindow.number.desc())
            .first()
        )
        if active_window is not None:
            for player_id, points, breakdown in (
                db.query(
                    PlayerGameweekStat.player_id,
                    PlayerGameweekStat.fantasy_points,
                    PlayerGameweekStat.breakdown,
                )
                .filter(
                    PlayerGameweekStat.transfer_window_id == active_window.id,
                    PlayerGameweekStat.player_id.in_(sport_player_ids),
                )
                .all()
            ):
                gameweek_by_player[player_id] = Decimal(points)
                if breakdown:
                    gameweek_breakdown_by_player[player_id] = breakdown

    for team_player in rows:
        total, gameweeks = totals_by_player.get(
            team_player.player_id, (Decimal("0"), 0)
        )
        team_player.total_points = total
        team_player.avg_points = (
            (total / gameweeks).quantize(Decimal("0.01"))
            if gameweeks > 0
            else Decimal("0")
        )
        team_player.gameweek_points = gameweek_by_player.get(
            team_player.player_id, Decimal("0")
        )
        team_player.gameweek_breakdown = gameweek_breakdown_by_player.get(
            team_player.player_id
        )



def get_current_lineup(db: Session, league_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    """Fetch the user's lineup. Squad is always returned; starting_lineup is
    window-scoped and will be empty when no transfer window is active."""
    team = _require_fantasy_team(db, league_id, user_id)
    league = _require_league(db, league_id)
    # Show the lineup for the gameweek you're setting up (next not-yet-locked).
    window = _find_editable_transfer_window(db, league)
    return _build_lineup_payload(db, team, window)



def get_live_lineup(db: Session, league_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    """Fetch the user's lineup for the in-progress gameweek (the one actually
    playing right now), not the upcoming one being set up. starting_lineup is
    empty when no window is currently live (e.g. between gameweeks)."""
    team = _require_fantasy_team(db, league_id, user_id)
    league = _require_league(db, league_id)
    window = _find_transfer_window(db, league)
    return _build_lineup_payload(db, team, window)



def _build_lineup_payload(
    db: Session, team: FantasyTeam, window: TransferWindow | None
) -> dict:
    lineup_entries = (
        db.query(TeamGameweekLineup)
        .filter(
            TeamGameweekLineup.fantasy_team_id == team.id,
            TeamGameweekLineup.transfer_window_id == window.id,
        )
        .options(joinedload(TeamGameweekLineup.player).joinedload(Player.sport))
        .order_by(TeamGameweekLineup.id.asc())
        .all()
    ) if window else []

    starting_lineup_entries = [e for e in lineup_entries if e.is_starter]
    bench_entries = sorted(
        (e for e in lineup_entries if not e.is_starter),
        key=lambda e: (e.bench_order if e.bench_order is not None else 1_000),
    )

    squad_players = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .options(joinedload(TeamPlayer.player).joinedload(Player.sport))
        .order_by(TeamPlayer.created_at.asc())
        .all()
    )

    created_at_by_player_id = {
        row.player_id: row.created_at
        for row in squad_players
    }
    fallback_created_at = datetime.now(timezone.utc)

    def _entry(row) -> dict:
        return {
            "player_id": row.player_id,
            "is_captain": row.is_captain,
            "is_vice_captain": row.is_vice_captain,
            "is_starter": row.is_starter,
            "bench_order": row.bench_order,
            "is_carried_forward": row.is_carried_forward,
            "player": row.player,
            "created_at": created_at_by_player_id.get(row.player_id, fallback_created_at),
        }

    starting_lineup = [_entry(row) for row in starting_lineup_entries if row.player]
    bench = [_entry(row) for row in bench_entries if row.player]

    return {
        "fantasy_team_id": team.id,
        "team_name": team.name,
        "transfer_window_id": window.id if window else None,
        "starting_lineup": starting_lineup,
        "bench": bench,
        "squad_players": squad_players,
    }



def update_lineup(
    db: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
    player_ids: list[uuid.UUID],
    captain_id: uuid.UUID,
    vice_captain_id: uuid.UUID,
    bench_player_ids: list[uuid.UUID] | None = None,
) -> dict:
    """Set starters and captains for the current window.
    
    Validates:
      - Transfer window is active and lineups aren't locked.
      - All players are on the user's fantasy team.
      - Captain/Vice are in the players list.
      - Position limits and squad size etc (handled in future, simple check for now).
    """
    team = _require_fantasy_team(db, league_id, user_id)
    league = _require_league(db, league_id)
    # Set the lineup for the gameweek you're setting up (next not-yet-locked).
    window = _editable_transfer_window(db, league)

    # Enforce lineup deadline and explicit lock flag
    from app.services.transfer_window_service import validate_transfer_window_for_lineup
    
    validate_transfer_window_for_lineup(window)

    # 1. Verify all player_ids belong to the team
    squad_players = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .options(joinedload(TeamPlayer.player).joinedload(Player.sport))
        .all()
    )

    owned_player_ids = {tp.player_id for tp in squad_players}
    if not all(pid in owned_player_ids for pid in player_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more players are not in your squad",
        )

    # Fetch the league's Sport objects (needed for sport-type detection and
    # mixed-league per-sport starter validation inside validate_lineup_for_league_type).
    league_sports = (
        db.query(Sport)
        .join(LeagueSport, LeagueSport.sport_id == Sport.id)
        .filter(LeagueSport.league_id == league.id)
        .all()
    )

    # Fetch the actual Player objects for the proposed starters.
    starters = (
        db.query(Player)
        .filter(Player.id.in_(player_ids))
        .all()
    )
    if len(starters) != len(player_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more selected lineup players were not found",
        )

    # ── Lineup structure validation (starters/bench/total + mixed sport) ─────
    try:
        validate_lineup_for_league_type(starters, league, league_sports)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(exc)},
        )

    # 2. Verify captain/vice are in the lineup
    if captain_id not in player_ids or vice_captain_id not in player_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captain and vice-captain must be in the starting lineup",
        )

    if captain_id == vice_captain_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captain and vice-captain must be different players",
        )

    # ── Position-slot validation for the starting lineup ────────────────────
    lineup_slots = (
        db.query(LineupSlot)
        .filter(LineupSlot.league_id == league.id)
        .all()
    )
    try:
        validate_position_slots(starters, lineup_slots)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    # ── Resolve the bench (everything in the squad that isn't a starter) ──────
    # Client-provided order takes priority for auto-substitution; any remaining
    # squad members are appended in squad (created_at) order.
    starters_set = set(player_ids)
    ordered_squad_ids = [
        tp.player_id
        for tp in sorted(squad_players, key=lambda tp: tp.created_at)
    ]
    bench_ids: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set(starters_set)
    for pid in (bench_player_ids or []):
        if pid in owned_player_ids and pid not in seen:
            bench_ids.append(pid)
            seen.add(pid)
    for pid in ordered_squad_ids:
        if pid not in seen:
            bench_ids.append(pid)
            seen.add(pid)

    # 3. Clear existing lineup for this window
    db.query(TeamGameweekLineup).filter(
        TeamGameweekLineup.fantasy_team_id == team.id,
        TeamGameweekLineup.transfer_window_id == window.id,
    ).delete()

    # 4. Create new entries — starters first, then the ordered bench.
    for pid in player_ids:
        db.add(TeamGameweekLineup(
            fantasy_team_id=team.id,
            transfer_window_id=window.id,
            player_id=pid,
            is_captain=(pid == captain_id),
            is_vice_captain=(pid == vice_captain_id),
            is_starter=True,
            bench_order=None,
        ))
    for order, pid in enumerate(bench_ids):
        db.add(TeamGameweekLineup(
            fantasy_team_id=team.id,
            transfer_window_id=window.id,
            player_id=pid,
            is_captain=False,
            is_vice_captain=False,
            is_starter=False,
            bench_order=order,
        ))

    db.flush()
    logger.info(
        "Updated lineup for team=%s in window=%s (starters: %d, bench: %d)",
        team.id, window.id, len(player_ids), len(bench_ids)
    )

    return get_current_lineup(db, league_id, user_id)
