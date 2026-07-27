"""Shared guards, window locators, and query options used by every league service module.

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

logger = logging.getLogger(__name__)




# ── Reusable eager-loading option sets ──────────────────────────────
#
# Why define these once instead of inline in every query?
#   1. DRY — the same schema (LeagueResponse) is produced by
#      create_league, get_league, get_leagues_for_user, update_league_status,
#      and start_draft. They all need the same load options.
#   2. Consistency — if LeagueResponse adds a new nested field,
#      you update ONE tuple, not five queries.
#   3. Readability — query code stays short.
#
# joinedload  → 1:1/M:1 — adds LEFT OUTER JOIN (one query, no extra round-trip)
# selectinload → 1:N   — issues SELECT ... WHERE id IN (...) (avoids row
#                         multiplication that JOIN causes on collections)

_LEAGUE_OPTIONS = (
    joinedload(League.owner),
    joinedload(League.season),
    selectinload(League.sports).joinedload(LeagueSport.sport),
    selectinload(League.memberships),
    selectinload(League.fantasy_teams).joinedload(FantasyTeam.user),
)


_MEMBERSHIP_OPTIONS = (
    joinedload(LeagueMembership.user),
)


_DRAFT_PICK_OPTIONS = (
    joinedload(DraftPick.player).joinedload(Player.sport),
    joinedload(DraftPick.fantasy_team).joinedload(FantasyTeam.user),
)


_TRANSFER_OPTIONS = (
    joinedload(Transfer.fantasy_team).joinedload(FantasyTeam.user),
    joinedload(Transfer.transfer_window),
    joinedload(Transfer.player_out).joinedload(Player.sport),
    joinedload(Transfer.player_in).joinedload(Player.sport),
)


VALID_TRANSITIONS: dict[str, list[str]] = {
    "setup": ["drafting", "active"],
    "drafting": ["active"],
    "active": ["completed"],
    "completed": [],
}


SUPPORTED_LEAGUE_SPORTS = {"football", "basketball"}



# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _generate_invite_code(db: Session) -> str:
    """Generate a unique, short invite code.

    Uses secrets.token_urlsafe(6) → ~8 URL-safe characters.
    Retries on collision (astronomically unlikely but not impossible).

    Why not UUID or a longer token?
    ────────────────────────────────
    Invite codes are shared verbally, pasted into chat, or typed on
    mobile. "xR4t_2Qw" is manageable; a full UUID is not.
    8 chars from a 64-char alphabet = 64^8 ≈ 2.8×10^14 possibilities.
    At 1 million leagues, collision probability is ~3.5×10^-9 per code.
    The retry loop is a safety net, not a regular path.
    """
    for _ in range(10):
        code = secrets.token_urlsafe(6)  # ~8 chars
        exists = db.query(
            db.query(League).filter(League.invite_code == code).exists()
        ).scalar()
        if not exists:
            return code
    # Practically unreachable — 10 consecutive collisions in 64^8 space
    raise RuntimeError("Failed to generate unique invite code after 10 attempts")



def _require_league(
    db: Session, league_id: uuid.UUID, *, eager: bool = False
) -> League:
    """Fetch league or raise 404. Used by most functions below.

    eager=True loads owner, season, sports→sport in the same query.
    Guard-only callers (update_league_status, make_transfer, etc.)
    pass eager=False (default) to skip the joins — they only need
    the League row for validation, then re-query with options at the
    end when they need the fully-loaded object for serialisation.
    """
    query = db.query(League).filter(League.id == league_id)
    if eager:
        query = query.options(*_LEAGUE_OPTIONS)
    league = query.first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found",
        )
    return league



def _require_membership(
    db: Session, league_id: uuid.UUID, user_id: uuid.UUID
) -> LeagueMembership:
    """Fetch membership or raise 403."""
    membership = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == user_id,
            LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    return membership



def _require_fantasy_team(
    db: Session, league_id: uuid.UUID, user_id: uuid.UUID
) -> FantasyTeam:
    """Fetch the user's fantasy team in this league, or raise 404."""
    team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == user_id,
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .first()
    )
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You don't have a fantasy team in this league",
        )
    return team



def _league_window_competition(db: Session, league: League) -> str | None:
    """The competition tag whose window schedule THIS league runs on
    ("EPL"/"LALIGA"/"BUNDESLIGA"), or None for an all-competitions football
    league, a unified multisport season, or a single-competition sport.

    A football season now holds several overlapping window schedules (one per
    competition + a combined NULL schedule), so every league-facing window
    lookup must pick the one matching the league's competition_filter — else it
    could read a sibling competition's gameweek or miscount the total."""
    season = league.season
    if season is None or season.sport_id is None:
        return None
    return (
        db.query(LeagueSport.competition_filter)
        .filter(
            LeagueSport.league_id == league.id,
            LeagueSport.sport_id == season.sport_id,
        )
        .scalar()
    )


def _window_competition_clause(comp: str | None):
    """Filter confining a query to the league's own window schedule."""
    return (
        TransferWindow.competition.is_(None)
        if comp is None
        else TransferWindow.competition == comp
    )


def _league_window_total(db: Session, league: League) -> int:
    """Number of gameweeks in the league's OWN competition schedule (e.g. EPL
    38, Bundesliga 34, combined 42) — NOT every window in the season, which now
    spans several competitions' schedules."""
    return (
        db.query(func.count(TransferWindow.id))
        .filter(
            TransferWindow.season_id == league.season_id,
            _window_competition_clause(_league_window_competition(db, league)),
        )
        .scalar()
    ) or 0


def _find_transfer_window(db: Session, league: League) -> TransferWindow | None:
    """Return the current active transfer window, or None if none exists."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == league.season_id,
            _window_competition_clause(_league_window_competition(db, league)),
            TransferWindow.start_at <= now,
            TransferWindow.end_at >= now,
        )
        .first()
    )



def _current_transfer_window(db: Session, league: League) -> TransferWindow:
    """Find the current (in-progress) transfer window for the league's season.

    Raises 409 if no transfer window is active — transfers/lineups can't
    happen outside of a transfer window.
    """
    window = _find_transfer_window(db, league)
    if not window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active transfer window — transfers are not possible right now",
        )
    return window



def _find_editable_transfer_window(db: Session, league: League) -> TransferWindow | None:
    """The window you can currently SET UP — the soonest window whose lineup
    deadline is still in the future. With start-anchored deadlines the
    in-progress window is already locked the moment it begins, so editing
    (transfers + lineups) targets the NEXT not-yet-locked gameweek while the
    current one plays. Returns None when every window has locked (season over)."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == league.season_id,
            _window_competition_clause(_league_window_competition(db, league)),
            TransferWindow.lineup_deadline_at > now,
        )
        .order_by(TransferWindow.start_at.asc())
        .first()
    )



def _editable_transfer_window(db: Session, league: League) -> TransferWindow:
    """Like _find_editable_transfer_window but raises 409 when nothing is open
    for editing (so transfer/lineup writes fail clearly)."""
    window = _find_editable_transfer_window(db, league)
    if not window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No upcoming gameweek is open to edit — its lineup has locked",
        )
    return window



def _league_sport_mode(db: Session, league_id: uuid.UUID) -> tuple[str, str]:
    """(sport_type, mode) for check_squad_constraints/get_position_minimums.

    sport_type is "football"/"basketball"/"mixed" (derive_sport_type over
    every sport attached to the league); mode is "mixed" when sport_type is
    "mixed", else "single". For a mixed league this makes
    get_position_minimums return {} (no constraint from this check) — mixed
    squad composition is already validated separately via MIXED_SPORT_QUOTAS
    in validate_squad_size.
    """
    sport_names = [
        name
        for (name,) in (
            db.query(Sport.name)
            .join(LeagueSport, LeagueSport.sport_id == Sport.id)
            .filter(LeagueSport.league_id == league_id)
            .all()
        )
    ]
    sport_type = derive_sport_type(sport_names)
    mode = "mixed" if sport_type == "mixed" else "single"
    return sport_type, mode



def _serialize_window(window: TransferWindow, total_windows: int) -> dict:
    from datetime import timezone, datetime as _dt

    now = _dt.now(timezone.utc)
    if now < window.start_at:
        status_str = "UPCOMING"
    elif window.start_at <= now <= window.end_at:
        status_str = "ACTIVE"
    else:
        status_str = "CLOSED"

    return {
        "id": window.id,
        "season_id": window.season_id,
        "number": window.number,
        "total_number": total_windows,
        "start_at": window.start_at,
        "end_at": window.end_at,
        "transfer_deadline_at": window.transfer_deadline_at,
        "lineup_deadline_at": window.lineup_deadline_at,
        "transfers_locked": window.transfers_locked,
        "lineup_locked": window.lineup_locked,
        "status": status_str,
    }
