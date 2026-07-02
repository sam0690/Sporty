"""Draft roster management — Phase 1: free agents.

See docs/DRAFT_ROSTER_MANAGEMENT.md. Applies to DRAFT leagues only; budget
leagues use the transfer system. Services never commit — the router owns the
transaction (project convention).
"""
from __future__ import annotations

import uuid
from collections import Counter

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.league.models import (
    FantasyTeam,
    League,
    LeagueSport,
    LeagueStatus,
    RosterMove,
    TeamPlayer,
    TransferWindow,
)
from app.league.sportConfigs import SPORT_CONFIGS, derive_sport_type
from app.player.models import Player


def _require_draft_team(
    db: Session, league_id: uuid.UUID, current_user: User
) -> tuple[League, FantasyTeam]:
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    if not league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Free agents are only available in draft leagues",
        )
    if league.status != LeagueStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="League is not ACTIVE")

    team = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id, FantasyTeam.user_id == current_user.id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fantasy team not found")
    return league, team


def _league_sport_ids(db: Session, league_id: uuid.UUID) -> set[uuid.UUID]:
    return {
        row[0]
        for row in db.query(LeagueSport.sport_id).filter(
            LeagueSport.league_id == league_id
        )
    }


def _actively_owned_player_ids(db: Session, league_id: uuid.UUID) -> set[uuid.UUID]:
    """Players currently on a roster in this league (released_window_id IS NULL)."""
    return {
        row[0]
        for row in db.query(TeamPlayer.player_id).filter(
            TeamPlayer.league_id == league_id,
            TeamPlayer.released_window_id.is_(None),
        )
    }


def _next_editable_window_id(db: Session, league: League) -> uuid.UUID:
    """The next not-yet-locked gameweek — where an add takes effect."""
    row = (
        db.query(TransferWindow.id)
        .filter(
            TransferWindow.season_id == league.season_id,
            TransferWindow.lineup_deadline_at > func.now(),
        )
        .order_by(TransferWindow.start_at.asc())
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No upcoming gameweek is open for roster moves",
        )
    return row[0]


def get_free_agents(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
    *,
    position: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Unowned, available players in the league's sport pool."""
    _require_draft_team(db, league_id, current_user)

    sport_ids = _league_sport_ids(db, league_id)
    if not sport_ids:
        return {"items": [], "total": 0}

    owned = _actively_owned_player_ids(db, league_id)

    q = db.query(Player).filter(
        Player.sport_id.in_(sport_ids),
        Player.is_available.is_(True),
    )
    if owned:
        q = q.filter(~Player.id.in_(owned))
    if position:
        q = q.filter(Player.position == position)
    if search:
        q = q.filter(Player.name.ilike(f"%{search.strip()}%"))

    total = q.count()
    players = (
        q.order_by(Player.cost.desc(), Player.name.asc())
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 100))
        .all()
    )
    items = [
        {
            "id": str(p.id),
            "name": p.name,
            "position": p.position,
            "real_team": p.real_team,
            "cost": float(p.cost),
            "sport": p.sport.name,
        }
        for p in players
    ]
    return {"items": items, "total": total}


def _position_violation(
    db: Session,
    team_id: uuid.UUID,
    add_player: Player,
    drop_player: Player,
) -> str | None:
    """Return a reason string if the swap breaks position minimums, else None."""
    sport_type = derive_sport_type([add_player.sport.name])
    minimums = SPORT_CONFIGS.get(sport_type, {}).get("position_minimums", {})
    if not minimums:
        return None  # e.g. basketball has no position constraints

    active_positions = (
        db.query(Player.position)
        .join(TeamPlayer, TeamPlayer.player_id == Player.id)
        .filter(
            TeamPlayer.fantasy_team_id == team_id,
            TeamPlayer.released_window_id.is_(None),
            Player.sport_id == add_player.sport_id,
        )
        .all()
    )
    counts: Counter[str] = Counter(row[0] for row in active_positions)
    counts[drop_player.position] -= 1
    counts[add_player.position] += 1

    for pos, required in minimums.items():
        if counts.get(pos, 0) < required:
            return f"Roster would drop below the {pos} minimum ({required})"
    return None


def check_add_drop(
    db: Session,
    league: League,
    team,
    add_player: Player,
    drop_player: Player,
    *,
    extra_owned_ids: frozenset[uuid.UUID] = frozenset(),
    lock_drop: bool = True,
) -> tuple[str | None, TeamPlayer | None]:
    """Validate an add/drop. Returns (reason_or_None, active_drop_row).

    Shared by instant free-agent claims (which raise on the reason) and waiver
    processing (which records the reason on the losing claim). `extra_owned_ids`
    lets waiver processing treat players already won earlier in the run as owned.
    """
    if add_player.id == drop_player.id:
        return "Add and drop players must differ", None

    sport_ids = _league_sport_ids(db, league.id)
    if add_player.sport_id not in sport_ids:
        return "Player is outside this league's allowed pool", None

    if len(sport_ids) > 1 and add_player.sport_id != drop_player.sport_id:
        return (
            "In a multisport league you must replace a player with one of the same sport",
            None,
        )

    drop_q = db.query(TeamPlayer).filter(
        TeamPlayer.fantasy_team_id == team.id,
        TeamPlayer.player_id == drop_player.id,
        TeamPlayer.released_window_id.is_(None),
    )
    if lock_drop:
        drop_q = drop_q.with_for_update()
    drop_tp = drop_q.first()
    if not drop_tp:
        return "You do not own the player you are trying to drop", None

    if (
        add_player.id in _actively_owned_player_ids(db, league.id)
        or add_player.id in extra_owned_ids
    ):
        return "That player has already been claimed", drop_tp

    reason = _position_violation(db, team.id, add_player, drop_player)
    if reason:
        return reason, drop_tp

    return None, drop_tp


def apply_add_drop(
    db: Session,
    league: League,
    team,
    add_player: Player,
    drop_player: Player,
    drop_tp: TeamPlayer,
    window_id: uuid.UUID,
    *,
    move_type: str,
    actor_user_id: uuid.UUID | None,
) -> None:
    """Release the dropped player, add the new one, and log the roster move.
    Assumes check_add_drop already passed. Does not flush/commit."""
    drop_tp.released_window_id = window_id
    db.add(
        TeamPlayer(
            fantasy_team_id=team.id,
            league_id=league.id,
            is_draft=True,
            player_id=add_player.id,
            sport_type=add_player.sport.name,
            acquired_window_id=window_id,
            cost_at_acquisition=add_player.cost,
        )
    )
    db.add(
        RosterMove(
            league_id=league.id,
            fantasy_team_id=team.id,
            move_type=move_type,
            add_player_id=add_player.id,
            drop_player_id=drop_player.id,
            window_id=window_id,
            actor_user_id=actor_user_id,
        )
    )


def _load_player(db: Session, player_id: uuid.UUID, label: str) -> Player:
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Player to {label} not found"
        )
    return player


def claim_free_agent(
    db: Session,
    league_id: uuid.UUID,
    add_player_id: uuid.UUID,
    drop_player_id: uuid.UUID,
    current_user: User,
) -> dict:
    """Instant add/drop of an unowned player. Add and drop are required — a
    drafted roster is always full, so a pickup must free a slot."""
    league, team = _require_draft_team(db, league_id, current_user)
    add_player = _load_player(db, add_player_id, "add")
    drop_player = _load_player(db, drop_player_id, "drop")

    reason, drop_tp = check_add_drop(db, league, team, add_player, drop_player)
    if reason:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=reason)

    window_id = _next_editable_window_id(db, league)
    apply_add_drop(
        db, league, team, add_player, drop_player, drop_tp, window_id,
        move_type="free_agent", actor_user_id=current_user.id,
    )

    try:
        db.flush()
    except IntegrityError:
        # Lost a race for the same player — the draft-ownership unique index fired.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That player was just claimed by another team",
        )

    return {
        "status": "ok",
        "added": {"id": str(add_player_id), "name": add_player.name},
        "dropped": {"id": str(drop_player_id), "name": drop_player.name},
        "effective_window_id": str(window_id),
    }
