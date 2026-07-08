"""
League service — business logic for league lifecycle, membership,
draft, and transfers.

Transaction convention (matches scoring service):
  Functions that MUTATE data do NOT call db.commit().
  The caller (router) owns the transaction boundary. This allows
  the router to compose multiple service calls in one transaction,
  or to add its own post-commit logic (e.g. WebSocket broadcast).

  Functions that only READ data are pure queries — no commit needed.
"""

import logging
import random
import secrets
import uuid
from datetime import date, datetime, timezone
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
from app.league.sportConfigs import SPORT_CONFIGS, derive_sport_type
from app.player.models import Player, PlayerGameweekStat
from app.services.budget_utils import calculate_refund
from app.services.scoring.window_locator import find_equivalent_season_for_sport
from app.core.config import settings
from app.squad.services import (
    check_squad_constraints,
    validate_lineup_for_league_type,
    validate_position_slots,
    validate_squad_size,
)


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

logger = logging.getLogger(__name__)

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


def _find_transfer_window(db: Session, league: League) -> TransferWindow | None:
    """Return the current active transfer window, or None if none exists."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == league.season_id,
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


# ═══════════════════════════════════════════════════════════════════════════════
# Section 1 — League lifecycle
# ═══════════════════════════════════════════════════════════════════════════════


def create_league(
    db: Session,
    data: LeagueCreate,
    owner: User,
) -> League:
    """Create a new league and auto-enrol the owner as the first member.

    Why auto-enrol?
    ────────────────
    The owner must be a member to participate (set lineup, make picks).
    Making the caller do a separate join_league() after create is error-
    prone: if the second call fails, the owner is locked out of their
    own league. Doing both in one transaction avoids that half-state.

    Does NOT commit — caller owns the transaction.
    """
    # Check for duplicate name in same season
    existing = db.query(League).filter(
        League.season_id == data.season_id,
        League.name == data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A league with the name '{data.name}' already exists for this season",
        )

    invite_code = _generate_invite_code(db)

    season = db.query(Season).filter(Season.id == data.season_id).first()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    season_sport = db.query(Sport).filter(Sport.id == season.sport_id).first()
    if not season_sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season sport not found",
        )

    if season_sport.name not in SUPPORTED_LEAGUE_SPORTS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{season_sport.name}' is not supported",
        )

    league_start: date = data.start_date or season.start_date
    league_end: date = data.end_date or season.end_date
    if league_end < league_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )

    new_id = uuid.uuid4()
    league = League(
        id=new_id,
        owner_id=owner.id,
        season_id=data.season_id,
        name=data.name,
        invite_code=invite_code,
        status=LeagueStatus.SETUP,
        is_public=data.is_public,
        max_teams=data.max_teams,
        squad_size=data.squad_size,
        budget_per_team=data.budget_per_team,
        draft_mode=data.draft_mode,
        allow_midseason_join=data.allow_midseason_join,
        transfers_per_window=data.transfers_per_window,
        transfer_day=data.transfer_day,
        start_date=league_start,
        end_date=league_end,
        # A freshly created league is the head of its own season lineage —
        # see renew_league() for how later seasons attach to this group.
        season_group_id=new_id,
        season_number=1,
    )
    db.add(league)

    # 2. Attach sports from payload
    # (Bug fix: removed default sport fallback and added strict validation)
    requested_sports = getattr(data, "sports", [])
    if not requested_sports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one sport must be specified in the creation payload",
        )

    # Derive squad size from sport type
    sport_type = derive_sport_type(requested_sports)
    squad_size = SPORT_CONFIGS[sport_type]["squad_size"]
    league.squad_size = squad_size

    # Resolve sport names to IDs
    sport_records = db.query(Sport).filter(Sport.name.in_(requested_sports)).all()
    found_names = {s.name for s in sport_records}
    for sport_name in requested_sports:
        if sport_name not in found_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sport '{sport_name}' not found",
            )
    
    for s in sport_records:
        league.sports.append(LeagueSport(sport_id=s.id))

    # 3. Auto-enrol owner
    membership = LeagueMembership(
        user_id=owner.id,
    )
    league.memberships.append(membership)

    db.flush()

    # Re-load with eager options so the caller can serialise to LeagueResponse
    return _require_league(db, league.id, eager=True)


def get_league(db: Session, league_id: uuid.UUID) -> League:
    """Fetch a single league or raise 404."""
    return _require_league(db, league_id, eager=True)


def get_leagues_for_user(db: Session, user_id: uuid.UUID) -> list[League]:
    """Return all leagues a user is a member of.

    Why query through LeagueMembership instead of League.owner_id?
    ──────────────────────────────────────────────────────────────
    A user can PARTICIPATE in leagues they don't OWN. owner_id only
    gives you leagues the user created. LeagueMembership gives you
    every league the user joined (including ones they own, since the
    owner is auto-enrolled in create_league).
    """
    leagues = (
        db.query(League)
        .join(LeagueMembership)
        .filter(LeagueMembership.user_id == user_id)
        .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .options(*_LEAGUE_OPTIONS)
        .order_by(League.created_at.desc())
        .all()
    )
    _attach_my_team_summaries(db, leagues, user_id)
    return leagues


def _attach_my_team_summaries(
    db: Session,
    leagues: list[League],
    user_id: uuid.UUID,
) -> None:
    """Populate each league's transient `my_team` attribute for the request user.

    Sets the user's team id + name, their TOTAL season points, and their season
    rank (position when every team in that league is ordered by total points,
    highest first). Ranking needs every team's total, so all teams across these
    leagues are aggregated in ONE grouped query instead of N per-league
    round-trips. Leagues where the user has no active team keep `my_team = None`.
    Rank stays None until scoring has begun (no team has points yet).

    `my_team` is a plain (non-mapped) instance attribute — LeagueResponse reads
    it via `from_attributes`. This is a read helper; it does not mutate the DB.
    """
    for league in leagues:
        league.my_team = None

    if not leagues:
        return

    league_ids = [league.id for league in leagues]

    # The requesting user's active team in each of these leagues (id + name).
    my_team_by_league = {
        team.league_id: team
        for team in (
            db.query(FantasyTeam)
            .filter(
                FantasyTeam.league_id.in_(league_ids),
                FantasyTeam.user_id == user_id,
                FantasyTeam.status == FantasyTeamStatus.ACTIVE,
            )
            .all()
        )
    }
    if not my_team_by_league:
        return

    # Total season points for every active team in these leagues, so we can
    # rank. outerjoin keeps teams with no scored weeks yet (total = 0).
    totals_by_league: dict[uuid.UUID, list] = {}
    total_rows = (
        db.query(
            FantasyTeam.league_id.label("league_id"),
            FantasyTeam.id.label("team_id"),
            func.coalesce(func.sum(TeamWeeklyScore.points), 0).label("total"),
        )
        .outerjoin(
            TeamWeeklyScore,
            TeamWeeklyScore.fantasy_team_id == FantasyTeam.id,
        )
        .filter(
            FantasyTeam.league_id.in_(league_ids),
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .group_by(FantasyTeam.league_id, FantasyTeam.id)
        .all()
    )
    for row in total_rows:
        totals_by_league.setdefault(row.league_id, []).append(row)

    for league in leagues:
        team = my_team_by_league.get(league.id)
        if team is None:
            continue

        rows = sorted(
            totals_by_league.get(league.id, []),
            key=lambda r: Decimal(r.total),
            reverse=True,
        )
        my_total = next(
            (Decimal(r.total) for r in rows if r.team_id == team.id),
            Decimal("0"),
        )
        # Only rank once scoring has started; before that every team ties at 0
        # and a position number would be meaningless.
        scoring_started = any(Decimal(r.total) > 0 for r in rows)
        rank = (
            next((i + 1 for i, r in enumerate(rows) if r.team_id == team.id), None)
            if scoring_started
            else None
        )

        league.my_team = {
            "id": team.id,
            "name": team.name,
            "rank": rank,
            "points": my_total,
        }


def update_league_status(
    db: Session,
    league_id: uuid.UUID,
    new_status: LeagueStatus,
    current_user: User,
    *,
    admin_override: bool = False,
) -> League:
    """Transition a league to a new lifecycle state.

    Valid transitions (enforced here, not at the DB level):
        SETUP     → DRAFTING | ACTIVE
        DRAFTING  → ACTIVE
        ACTIVE    → COMPLETED
        (no backward transitions — a completed league can't revert)

    Why enforce at the service layer, not DB?
    ──────────────────────────────────────────
    A CHECK constraint can't express "old value must be X to set Y"
    because CHECK only sees the NEW row, not the old one. A trigger
    could do it, but trigger-based state machines are hard to debug
    and test. Service-layer enforcement is explicit and testable.

    Only the league OWNER can change status (admin_override=True bypasses
    this for platform-admin use — see app/admin/services.py).
    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if not admin_override and league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can change the status",
        )

    # Mode-aware lifecycle restrictions:
    # - Budget leagues do not have a drafting phase.
    # - Draft leagues should not skip directly from setup to active.
    if not league.draft_mode and new_status == LeagueStatus.DRAFTING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Budget leagues cannot transition to drafting",
        )
    if (
        league.draft_mode
        and league.status == LeagueStatus.SETUP
        and new_status == LeagueStatus.ACTIVE
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft leagues must enter drafting before becoming active",
        )

    if (
        not league.draft_mode
        and league.status == LeagueStatus.SETUP
        and new_status == LeagueStatus.ACTIVE
    ):
        member_count = (
            db.query(func.count(LeagueMembership.id))
            .filter(LeagueMembership.league_id == league.id)
            .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
            .scalar()
        )
        if member_count < settings.LEAGUE_MIN_MEMBERS_TO_ACTIVATE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "At least "
                    f"{settings.LEAGUE_MIN_MEMBERS_TO_ACTIVATE} members are required "
                    "before activating this league"
                ),
            )

    allowed_next = VALID_TRANSITIONS.get(league.status.value, [])
    if new_status.value not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot transition from '{league.status.value}' "
                f"to '{new_status.value}'"
            ),
        )

    league.status = new_status
    db.flush()

    # Re-load with eager options so the caller can serialise to LeagueResponse
    return _require_league(db, league_id, eager=True)


def get_season_history(db: Session, league_id: uuid.UUID) -> list[League]:
    """Return every league in the same season lineage as league_id, oldest first.

    A league's own lineage always includes itself (season_group_id defaults
    to its own id when it has never been renewed — see create_league).
    """
    league = _require_league(db, league_id)
    return (
        db.query(League)
        .filter(League.season_group_id == league.season_group_id)
        .order_by(League.season_number.asc())
        .all()
    )


def _next_available_season(db: Session, source: League) -> Season:
    """Pick the season to renew `source` into when the caller didn't specify one.

    Earliest active Season, for the source league's first sport, starting
    after the source league's end_date. Raises 409 if none exists yet —
    the commissioner has to wait for an admin to create next year's Season
    (see app/admin/services.py:create_season_admin).
    """
    first_sport_id = (
        db.query(LeagueSport.sport_id)
        .filter(LeagueSport.league_id == source.id)
        .order_by(LeagueSport.created_at.asc())
        .limit(1)
        .scalar()
    )
    query = db.query(Season).filter(Season.is_active.is_(True))
    if first_sport_id:
        query = query.filter(Season.sport_id == first_sport_id)
    if source.end_date:
        query = query.filter(Season.start_date > source.end_date)
    season = query.order_by(Season.start_date.asc()).first()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Next season isn't available yet — ask an admin to create it",
        )
    return season


def renew_league(
    db: Session,
    source_league_id: uuid.UUID,
    target_season_id: uuid.UUID | None,
    current_user: User,
    *,
    admin_override: bool = False,
) -> League:
    """Start the next season of a completed league: a new League row, same
    lineage (season_group_id, season_number + 1), same settings/sports/slots,
    members auto carried over. Squads are intentionally NOT copied — team
    creation is already a separate step (start_draft / build_initial_team),
    so the new league naturally starts with zero FantasyTeam rows.

    Only the league OWNER can renew (admin_override=True bypasses this for
    platform-admin use). Does NOT commit — caller owns the transaction.
    """
    source = _require_league(db, source_league_id, eager=True)

    if not admin_override and source.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can start the next season",
        )

    if source.status != LeagueStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only completed leagues can start a new season",
        )

    already_renewed = (
        db.query(League)
        .filter(
            League.season_group_id == source.season_group_id,
            League.season_number == source.season_number + 1,
        )
        .first()
    )
    if already_renewed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league has already started its next season",
        )

    if target_season_id is not None:
        target_season = db.query(Season).filter(Season.id == target_season_id).first()
        if not target_season:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season not found")
        if source.end_date and target_season.start_date <= source.end_date:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Target season must start after the current season ends",
            )
    else:
        target_season = _next_available_season(db, source)

    new_id = uuid.uuid4()
    new_league = League(
        id=new_id,
        owner_id=source.owner_id,
        season_id=target_season.id,
        name=source.name,
        invite_code=_generate_invite_code(db),
        status=LeagueStatus.SETUP,
        is_public=source.is_public,
        max_teams=source.max_teams,
        squad_size=source.squad_size,
        budget_per_team=source.budget_per_team,
        draft_mode=source.draft_mode,
        allow_midseason_join=source.allow_midseason_join,
        transfers_per_window=source.transfers_per_window,
        transfer_day=source.transfer_day,
        start_date=target_season.start_date,
        end_date=target_season.end_date,
        season_group_id=source.season_group_id,
        season_number=source.season_number + 1,
    )
    db.add(new_league)

    for league_sport in source.sports:
        new_league.sports.append(LeagueSport(sport_id=league_sport.sport_id))

    source_slots = db.query(LineupSlot).filter(LineupSlot.league_id == source.id).all()
    for slot in source_slots:
        db.add(LineupSlot(
            league_id=new_id,
            sport_id=slot.sport_id,
            position=slot.position,
            min_count=slot.min_count,
            max_count=slot.max_count,
        ))

    active_members = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == source.id,
            LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
        )
        .all()
    )
    for member in active_members:
        new_league.memberships.append(LeagueMembership(user_id=member.user_id))

    db.flush()

    return _require_league(db, new_id, eager=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Section 2 — Membership
# ═══════════════════════════════════════════════════════════════════════════════


def join_league(
    db: Session,
    invite_code: str,
    user: User,
) -> LeagueMembership:
    """Join a league using its invite code.

    Guards:
      1. Invite code must match an existing league.
      2. League must be in SETUP status (no joining mid-draft or mid-season).
      3. User must not already be a member (idempotency via 409, not silent
         duplicate).
      4. League must not be full (member count < max_teams).

    Why check member count with .count() instead of len(league.memberships)?
    ────────────────────────────────────────────────────────────────────────
    len(league.memberships) would load ALL membership objects into memory
    just to count them. A COUNT(*) query is cheaper — the DB counts rows
    without materialising them.

    Does NOT commit — caller owns the transaction.
    """
    normalized_code = invite_code.strip()

    # Prefer exact match first (fast path), then fallback to case-insensitive
    # lookup so users can join even if they typed different letter casing.
    league = (
        db.query(League)
        .filter(League.invite_code == normalized_code)
        .first()
    )
    if not league:
        case_insensitive_matches = (
            db.query(League)
            .filter(func.lower(League.invite_code) == normalized_code.lower())
            .all()
        )
        if len(case_insensitive_matches) == 1:
            league = case_insensitive_matches[0]
        elif len(case_insensitive_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invite code is ambiguous; please use exact casing",
            )

    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    # Lock the target league row so concurrent joins serialize before
    # capacity is checked and the membership row is inserted/reactivated.
    league = (
        db.query(League)
        .filter(League.id == league.id)
        .with_for_update()
        .first()
    )
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found",
        )

    is_setup_join = league.status == LeagueStatus.SETUP
    is_midseason_budget_join = (
        league.status == LeagueStatus.ACTIVE
        and not league.draft_mode
        and league.allow_midseason_join
    )
    if not is_setup_join and not is_midseason_budget_join:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league is no longer accepting new members",
        )

    # Already a member?
    existing = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == league.id,
            LeagueMembership.user_id == user.id,
        )
        .first()
    )
    if existing and existing.status == LeagueMembershipStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this league",
        )

    # Full?
    member_count = (
        db.query(func.count(LeagueMembership.id))
        .filter(LeagueMembership.league_id == league.id)
        .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .scalar()
    )
    if member_count >= league.max_teams:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league is full",
        )

    eligible_from_window_id = None
    if is_midseason_budget_join:
        now = datetime.now(timezone.utc)
        next_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                TransferWindow.start_at > now,
            )
            .order_by(TransferWindow.start_at.asc())
            .first()
        )
        if not next_window:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No upcoming transfer window is available for late joiners",
            )
        eligible_from_window_id = next_window.id

    if existing:
        membership = existing
        membership.status = LeagueMembershipStatus.ACTIVE
        if eligible_from_window_id is not None:
            membership.eligible_from_window_id = eligible_from_window_id
    else:
        membership = LeagueMembership(
            league_id=league.id,
            user_id=user.id,
            eligible_from_window_id=eligible_from_window_id,
        )
        db.add(membership)

    team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league.id,
            FantasyTeam.user_id == user.id,
        )
        .first()
    )
    if team and team.status == FantasyTeamStatus.ARCHIVED:
        active_roster_size = (
            db.query(func.count(TeamPlayer.id))
            .filter(
                TeamPlayer.fantasy_team_id == team.id,
                TeamPlayer.released_window_id.is_(None),
            )
            .scalar()
        )
        if (
            team.starting_budget != league.budget_per_team
            or team.starting_squad_size != league.squad_size
            or active_roster_size > league.squad_size
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Archived team no longer matches this league; rebuild required",
            )

    if team:
        team.status = FantasyTeamStatus.ACTIVE

    db.flush()

    # Re-load with user relationship for MembershipResponse serialisation
    return (
        db.query(LeagueMembership)
        .options(*_MEMBERSHIP_OPTIONS)
        .filter(LeagueMembership.id == membership.id)
        .first()
    )


def get_members(
    db: Session,
    league_id: uuid.UUID,
) -> list[LeagueMembership]:
    """Return all members of a league, ordered by join date."""
    _require_league(db, league_id)
    return (
        db.query(LeagueMembership)
        .options(*_MEMBERSHIP_OPTIONS)
        .filter(LeagueMembership.league_id == league_id)
        .order_by(LeagueMembership.joined_at)
        .all()
    )


def delete_league(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
    *,
    admin_override: bool = False,
) -> None:
    """Delete a league and all related data.

    Only the league owner can delete the league (admin_override=True bypasses
    this for platform-admin use — see app/admin/services.py). Related rows
    are removed via existing FK and ORM cascades.
    """
    league = _require_league(db, league_id)

    if not admin_override and league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can delete this league",
        )

    db.delete(league)
    db.flush()


def leave_league(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
) -> None:
    """Leave a league for non-owner members.

    Marks membership as LEFT and archives the user's team (if present).
    Team-scoped rows stay in place so the history can be restored on rejoin.
    """
    league = _require_league(db, league_id)
    membership = _require_membership(db, league_id, current_user.id)

    if league.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="League owner cannot leave the league",
        )

    team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == current_user.id,
        )
        .first()
    )
    if team:
        team.status = FantasyTeamStatus.ARCHIVED

    membership.status = LeagueMembershipStatus.LEFT
    db.flush()


# ═══════════════════════════════════════════════════════════════════════════════
# Section 3 — Draft
# ═══════════════════════════════════════════════════════════════════════════════
#
# Draft flow overview:
#   1. Owner calls start_draft() → league transitions to DRAFTING,
#      every member gets a randomised draft_position, and a
#      FantasyTeam is auto-created for each member.
#   2. Each member calls make_draft_pick() in order.
#      Snake draft: round 1 → 1,2,3,...,N; round 2 → N,...,3,2,1; etc.
#   3. After all rounds are complete, owner calls update_league_status()
#      to transition from DRAFTING → ACTIVE.
#
# Why snake draft?
# ────────────────
# A straight draft (same order every round) gives pick #1 the best player
# in EVERY round. A snake draft reverses the order in even rounds, giving
# the last picker in round 1 the first pick in round 2. This is the
# standard fairness mechanism in fantasy sports.


def start_draft(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
) -> League:
    """Initialise the draft: assign positions, create teams, transition status.

    Guards:
      1. Only the owner can start the draft.
      2. League must be in SETUP status.
      3. At least 2 members must exist (can't draft alone).
      4. At least 1 sport must be attached to the league.

    What this does atomically:
      a. Randomise draft_position for each member (1..N).
      b. Create a FantasyTeam for each member (budget = league.budget_per_team).
      c. Transition league → DRAFTING.

    Why create teams here instead of letting users create them?
    ───────────────────────────────────────────────────────────
    The draft requires every member to have a team (picks are assigned
    to a team). If team creation is optional and a member forgets,
    the draft can't proceed. Creating teams during start_draft
    guarantees every member has one.

    Team names default to "{username}'s Team" — users can rename later.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can start the draft",
        )

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft can only be started from SETUP status",
        )

    # Fetch members
    members: list[LeagueMembership] = (
        db.query(LeagueMembership)
        .filter(LeagueMembership.league_id == league_id)
        .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .all()
    )

    if len(members) < 2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="At least 2 members are required to start the draft",
        )

    # Verify at least one sport is attached
    sport_count = (
        db.query(func.count())
        .select_from(LeagueSport)
        .filter(LeagueSport.league_id == league_id)
        .scalar()
    )
    if sport_count == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attach at least one sport before starting the draft",
        )

    # a. Randomise draft positions
    positions = list(range(1, len(members) + 1))
    random.shuffle(positions)
    for member, pos in zip(members, positions):
        member.draft_position = pos

    # b. Create a FantasyTeam for each member
    #
    # Bulk-load all users in ONE query instead of N queries in a loop.
    # The original pattern:
    #   for member in members:
    #       user = db.query(User).filter(User.id == member.user_id).first()
    # fires one SELECT per member — classic N+1. With 20 members that's
    # 20 round-trips for data we could fetch in one WHERE ... IN (...).
    member_user_ids = [m.user_id for m in members]
    users_by_id: dict[uuid.UUID, User] = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(member_user_ids)).all()
    }

    for member in members:
        user = users_by_id.get(member.user_id)
        team_name = f"{user.username}'s Team" if user else "My Team"

        team = FantasyTeam(
            league_id=league_id,
            user_id=member.user_id,
            name=team_name,
            current_budget=league.budget_per_team,
            starting_budget=league.budget_per_team,
            starting_squad_size=league.squad_size,
        )
        db.add(team)

    # c. Transition to DRAFTING
    league.status = LeagueStatus.DRAFTING
    db.flush()

    # Re-load with eager options for LeagueResponse serialisation
    return _require_league(db, league_id, eager=True)


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


def make_draft_pick(
    db: Session,
    league_id: uuid.UUID,
    player_id: uuid.UUID,
    current_user: User,
) -> DraftPick:
    """Record a single draft pick (snake draft order).

    Guards:
      1. League must be in DRAFTING status.
      2. User must be a member with a fantasy team.
      3. It must be the user's turn (snake draft order).
      4. Player must exist and be available.
      5. Player must not already be drafted in this league.
      6. Player must belong to a sport attached to this league.
      7. Team must not have exceeded squad_size.
      8. Pick must not exceed max-per-club, or (once the squad would be
         complete) leave a position minimum unmet.

    No budget guard: draft picks have no cost cap (see inline comment below).

    Snake draft order:
    ──────────────────
    With N members, total picks = N × squad_size.
    Round R, pick position within round:
      Odd round  (1, 3, 5…): positions 1, 2, 3, …, N  (ascending)
      Even round (2, 4, 6…): positions N, N-1, …, 1    (descending)

    Given the overall pick_number (1-based), we derive:
      round_number  = ((pick_number - 1) // N) + 1
      position_in_round:
        if round is odd:  ((pick_number - 1) % N) + 1
        if round is even: N - ((pick_number - 1) % N)

    The member whose draft_position matches position_in_round is
    the one whose turn it is.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.DRAFTING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League is not in DRAFTING status",
        )

    turn = get_current_draft_turn(db, league_id)
    if turn["is_draft_complete"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft is complete — all picks have been made",
        )

    if turn["current_turn_user_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="It is not your turn to pick",
        )

    next_pick_number = int(turn["next_pick_number"])
    round_number = int(turn["round_number"])
    total_picks_possible = int(turn["total_picks_possible"])

    # Validate player
    player = (
        db.query(Player)
        .options(selectinload(Player.sport))
        .filter(Player.id == player_id)
        .first()
    )
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player not found",
        )

    if not player.is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This player is not available",
        )

    # Player's sport must be attached to the league
    sport_attached = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == player.sport_id,
        )
        .first()
    )
    if not sport_attached:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This player's sport is not part of this league",
        )

    # Already drafted in this league?
    already_drafted = (
        db.query(DraftPick)
        .filter(
            DraftPick.league_id == league_id,
            DraftPick.player_id == player_id,
        )
        .first()
    )
    if already_drafted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This player has already been drafted in this league",
        )

    # Get the user's fantasy team
    team = _require_fantasy_team(db, league_id, current_user.id)

    # Squad size limit
    current_squad_size = (
        db.query(func.count(TeamPlayer.id))
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .scalar()
    )
    if current_squad_size >= league.squad_size:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your squad is already full",
        )

    # Max-per-club / position-minimum constraints
    current_roster = (
        db.query(TeamPlayer)
        .options(joinedload(TeamPlayer.player))
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    sport_type, mode = _league_sport_mode(db, league_id)
    violation = check_squad_constraints(
        current_roster, league, sport_type, mode, player
    )
    if violation:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=violation)

    # ── All guards passed — execute the pick ────────────────────────
    # No budget check: draft leagues have no cost cap on picks — the only
    # scarcity mechanism is turn-based exclusivity (one owner per player).
    # Player.cost still gets recorded (cost_at_acquisition below) purely for
    # squad-value display/history, same as a budget-mode league.

    # We need the first transfer window as the acquired_window for TeamPlayer
    first_window = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id)
        .order_by(TransferWindow.number)
        .first()
    )
    if not first_window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No transfer windows exist for this season",
        )

    # Record the draft pick (immutable audit log)
    pick = DraftPick(
        league_id=league_id,
        fantasy_team_id=team.id,
        player_id=player_id,
        round_number=round_number,
        pick_number=next_pick_number,
    )
    db.add(pick)

    # Add player to the team's roster
    team_player = TeamPlayer(
        fantasy_team_id=team.id,
        league_id=league_id,
        is_draft=league.draft_mode,
        player_id=player_id,
        sport_type=player.sport.name,
        acquired_window_id=first_window.id,
        cost_at_acquisition=player.cost,
    )
    db.add(team_player)

    # ── Auto-transition: DRAFTING → ACTIVE after last pick ──────────
    #
    # Product decision: automatic, not manual.
    #
    # Why auto-transition instead of requiring the owner to call
    # update_league_status(DRAFTING → ACTIVE)?
    #
    #   Manual: The owner might forget, leaving the league stuck in
    #   DRAFTING after all picks are done. Every member would see
    #   "draft in progress" with nothing left to pick. Bad UX.
    #
    #   Automatic: The system knows when the last pick is made
    #   (next_pick_number == total_picks_possible). Transitioning
    #   immediately is deterministic and removes a failure mode.
    #
    #   If we later need a "review draft" phase between DRAFTING and
    #   ACTIVE, we add a new status (DRAFT_COMPLETE) rather than
    #   leaving the league in a limbo state.
    if next_pick_number >= total_picks_possible:
        league.status = LeagueStatus.ACTIVE
        logger.info("Draft complete for league=%s — auto-transitioned to ACTIVE", league_id)
        # Seed the waiver order (reverse draft order) now the draft is done.
        from app.services import waiver_service

        db.flush()
        waiver_service.init_waiver_order(db, league)

    db.flush()

    # Re-load with eager options for DraftPickResponse serialisation
    return (
        db.query(DraftPick)
        .options(*_DRAFT_PICK_OPTIONS)
        .filter(DraftPick.id == pick.id)
        .first()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Section 4 — Transfers
# ═══════════════════════════════════════════════════════════════════════════════
#
# Transfer rules (budget-mode leagues):
#   - League must be ACTIVE (transfers happen during the season, not draft).
#   - A transfer requires a transfer window with transfers NOT locked.
#   - A transfer is a swap: one player OUT, one player IN.
#   - Each team is capped at league.transfers_per_window transfers per window.
#   - No penalty system — just a hard cap on transfers.
#   - The incoming player's cost is deducted from the team's budget, and
#     the outgoing player's original acquisition cost is refunded.
#
# Q: Why refund cost_at_acquisition instead of the player's current cost?
# A: This is a design choice. Refunding current cost rewards holding a
#    player whose price rises — you buy at 7.0, sell at 9.0, net +2.0.
#    Refunding acquisition cost means no profit/loss from price changes —
#    simpler, no "gaming the market" exploits. Both are valid; FPL uses
#    a selling price = (current + acquisition) / 2. We use acquisition
#    cost for simplicity in v1. Easy to change later — it's one line.


def make_transfer(
    db: Session,
    league_id: uuid.UUID,
    player_out_id: uuid.UUID,
    player_in_id: uuid.UUID,
    current_user: User,
) -> Transfer:
    """Execute a player swap: drop player_out, bring in player_in.

    Guards:
      1. League is ACTIVE.
      2. Current transfer window exists and transfers are NOT locked.
      3. User has a fantasy team in this league.
      4. player_out is currently on the user's team.
      5. player_in exists, is available, and plays a sport attached
         to this league.
      6. Team can afford player_in after refunding player_out.
      7. player_out != player_in (enforced by DB, but checked early
         for a better error message).
      8. Team has not exceeded transfers_per_window limit for this window.
      9. Swap must not exceed max-per-club, or (once the squad would be
         complete) leave a position minimum unmet.

    Budget-mode transfers intentionally mirror budget-mode initial squad
    creation: player ownership is scoped to the fantasy team, not the
    league. The only uniqueness enforced here is the active roster rule
    for the current team.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfers are only allowed when the league is ACTIVE",
        )

    # Edit the next not-yet-locked gameweek (deadlines lock at gameweek start,
    # so you set up the upcoming window while the current one plays).
    window = _editable_transfer_window(db, league)

    # Enforce transfer deadline and explicit lock flag
    from app.services.transfer_window_service import validate_transfer_window_for_transfer

    validate_transfer_window_for_transfer(window)

    if player_out_id == player_in_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot swap a player with themselves",
        )

    team = _require_fantasy_team(db, league_id, current_user.id)

    # ── Check transfer limit ────────────────────────────────────────
    transfers_this_window = (
        db.query(func.count(Transfer.id))
        .filter(
            Transfer.fantasy_team_id == team.id,
            Transfer.transfer_window_id == window.id,
        )
        .scalar()
    )

    if transfers_this_window >= league.transfers_per_window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transfer limit reached ({league.transfers_per_window} per window)",
        )

    # ── Validate player_out: must be active on the user's team ──────
    team_player_out = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.player_id == player_out_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .first()
    )
    if not team_player_out:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="player_out is not on your team",
        )

    # ── Validate player_in ──────────────────────────────────────────
    player_in = (
        db.query(Player)
        .options(selectinload(Player.sport))
        .filter(Player.id == player_in_id)
        .first()
    )
    if not player_in:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="player_in not found",
        )

    if not player_in.is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="player_in is not available",
        )

    # Sport must be attached to the league
    sport_attached = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == player_in.sport_id,
        )
        .first()
    )
    if not sport_attached:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="player_in's sport is not part of this league",
        )

    # ── Budget check ────────────────────────────────────────────────
    # Refund outgoing player with fixed transaction penalty.
    refund_amount, penalty = calculate_refund(team_player_out.cost_at_acquisition)
    budget_after = team.current_budget + refund_amount - player_in.cost
    if budget_after < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Insufficient budget: releasing gives back "
                f"{refund_amount} (penalty {penalty}), incoming costs "
                f"{player_in.cost}, shortfall of {abs(budget_after)}"
            ),
        )

    # ── Max-per-club / position-minimum constraints ─────────────────
    current_roster = (
        db.query(TeamPlayer)
        .options(joinedload(TeamPlayer.player))
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    sport_type, mode = _league_sport_mode(db, league_id)
    violation = check_squad_constraints(
        current_roster, league, sport_type, mode, player_in, team_player_out
    )
    if violation:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=violation)

    # ── Execute the transfer ────────────────────────────────────────

    # Release the outgoing player
    team_player_out.released_window_id = window.id

    # Add the incoming player
    team_player_in = TeamPlayer(
        fantasy_team_id=team.id,
        league_id=league_id,
        is_draft=league.draft_mode,
        player_id=player_in_id,
        sport_type=player_in.sport.name,
        acquired_window_id=window.id,
        cost_at_acquisition=player_in.cost,
    )
    db.add(team_player_in)

    db.add(
        BudgetTransaction(
            fantasy_team_id=team.id,
            player_id=player_out_id,
            transfer_window_id=window.id,
            transaction_type="transfer_out_refund",
            amount=refund_amount,
            penalty_applied=penalty,
        )
    )
    db.add(
        BudgetTransaction(
            fantasy_team_id=team.id,
            player_id=player_in_id,
            transfer_window_id=window.id,
            transaction_type="transfer_in_cost",
            amount=player_in.cost,
            penalty_applied=Decimal("0.00"),
        )
    )

    # Update budget
    team.current_budget = budget_after

    # Record the transfer (immutable audit log)
    transfer = Transfer(
        fantasy_team_id=team.id,
        transfer_window_id=window.id,
        player_out_id=player_out_id,
        player_in_id=player_in_id,
        cost_at_transfer=player_in.cost,
    )
    db.add(transfer)
    db.flush()

    logger.info(
        "Transfer: team=%s out=%s in=%s window=%s",
        team.id, player_out_id, player_in_id, window.id,
    )

    # Re-load with eager options for Transfer response serialisation
    return (
        db.query(Transfer)
        .options(*_TRANSFER_OPTIONS)
        .filter(Transfer.id == transfer.id)
        .first()
    )


def get_transfers(
    db: Session,
    league_id: uuid.UUID,
) -> list[Transfer]:
    """Return all transfers for a league, newest first.

    Joins through FantasyTeam to filter by league, since Transfer
    doesn't have a direct league_id column — it's normalised through
    fantasy_team → league.
    """
    _require_league(db, league_id)
    return (
        db.query(Transfer)
        .options(*_TRANSFER_OPTIONS)
        .join(FantasyTeam, Transfer.fantasy_team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(Transfer.created_at.desc())
        .all()
    )


def get_user_transfers_grouped_by_league(
    db: Session,
    user_id: uuid.UUID,
) -> list[dict]:
    """Return authenticated user's transfers grouped by league, newest first."""
    transfers = (
        db.query(Transfer)
        .options(
            *_TRANSFER_OPTIONS,
            joinedload(Transfer.fantasy_team)
            .joinedload(FantasyTeam.league)
            .selectinload(League.sports)
            .joinedload(LeagueSport.sport),
        )
        .join(FantasyTeam, Transfer.fantasy_team_id == FantasyTeam.id)
        .filter(FantasyTeam.user_id == user_id)
        .order_by(Transfer.created_at.desc())
        .all()
    )

    grouped_by_league_id: dict[uuid.UUID, dict] = {}
    league_order: list[uuid.UUID] = []

    for transfer in transfers:
        league = transfer.fantasy_team.league
        league_id = league.id

        if league_id not in grouped_by_league_id:
            grouped_by_league_id[league_id] = {
                "league": league,
                "transfers": [],
            }
            league_order.append(league_id)

        grouped_by_league_id[league_id]["transfers"].append(transfer)

    return [grouped_by_league_id[league_id] for league_id in league_order]


# ═══════════════════════════════════════════════════════════════════════════════
# Section 5 — League sport & lineup slot management
# ═══════════════════════════════════════════════════════════════════════════════


def add_sport(
    db: Session,
    league_id: uuid.UUID,
    sport_name: str,
) -> LeagueSport:
    """Attach a sport to a league (SETUP status only).

    Guards:
      1. League must be in SETUP status — can't add a sport mid-draft
         or mid-season.
      2. Sport must exist and be active.
      3. Sport must not already be attached to this league.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sports can only be added during SETUP",
        )

    sport = (
        db.query(Sport)
        .filter(Sport.name == sport_name.strip().lower())
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' not found",
        )

    if not sport.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{sport_name}' is currently disabled",
        )

    if sport.name not in SUPPORTED_LEAGUE_SPORTS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{sport_name}' is not supported",
        )

    existing = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{sport_name}' is already attached to this league",
        )

    league_sport = LeagueSport(
        league_id=league_id,
        sport_id=sport.id,
    )
    db.add(league_sport)
    db.flush()

    # Re-load with sport relationship for LeagueSportResponse serialisation
    return (
        db.query(LeagueSport)
        .options(joinedload(LeagueSport.sport))
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )


def remove_sport(
    db: Session,
    league_id: uuid.UUID,
    sport_name: str,
) -> None:
    """Detach a sport from a league (SETUP status only).

    Guards:
      1. League must be in SETUP status.
      2. Sport must exist.
      3. Sport must actually be attached to this league.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sports can only be removed during SETUP",
        )

    sport = (
        db.query(Sport)
        .filter(Sport.name == sport_name.strip().lower())
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' not found",
        )

    league_sport = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )
    if not league_sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' is not attached to this league",
        )

    db.delete(league_sport)
    db.flush()


def add_lineup_slot(
    db: Session,
    league_id: uuid.UUID,
    data: LineupSlotCreate,
) -> LineupSlot:
    """Define a position requirement for a league+sport combination.

    Example: league X, football → min 1 GKP, max 1 GKP.

    Guards:
      1. League must be in SETUP status.
      2. Sport must exist and be attached to the league.
      3. Position must not already be defined for this league+sport
         (the DB has a unique constraint, but catching it here gives
         a better error message than a 500 IntegrityError).

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lineup slots can only be configured during SETUP",
        )

    sport = (
        db.query(Sport)
        .filter(Sport.name == data.sport_name)
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{data.sport_name}' not found",
        )

    # Sport must be attached to the league
    sport_attached = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )
    if not sport_attached:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{data.sport_name}' is not attached to this league",
        )

    # Duplicate position check
    existing = (
        db.query(LineupSlot)
        .filter(
            LineupSlot.league_id == league_id,
            LineupSlot.sport_id == sport.id,
            LineupSlot.position == data.position,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Position '{data.position}' is already defined "
                f"for sport '{data.sport_name}' in this league"
            ),
        )

    slot = LineupSlot(
        league_id=league_id,
        sport_id=sport.id,
        position=data.position,
        min_count=data.min_count,
        max_count=data.max_count,
    )
    db.add(slot)
    db.flush()

    # Re-load with sport relationship for LineupSlotResponse serialisation
    return (
        db.query(LineupSlot)
        .options(joinedload(LineupSlot.sport))
        .filter(LineupSlot.id == slot.id)
        .first()
    )


def discover_public_leagues(db: Session) -> list[League]:
    """Return public leagues that are currently joinable.

        Includes:
            - SETUP leagues (standard join flow)
            - ACTIVE budget-mode leagues with allow_midseason_join=True
                and at least one upcoming transfer window.

    Ordered by newest first so fresh leagues appear at the top.
    """
    now = datetime.now(timezone.utc)
    leagues = (
        db.query(League)
        .filter(
            League.is_public == True,
            or_(
                League.status == LeagueStatus.SETUP,
                and_(
                    League.status == LeagueStatus.ACTIVE,
                    League.draft_mode == False,
                    League.allow_midseason_join == True,
                ),
            ),
        )
        .options(*_LEAGUE_OPTIONS)
        .order_by(League.created_at.desc())
        .all()
    )

    filtered: list[League] = []
    for league in leagues:
        if league.status == LeagueStatus.SETUP:
            league.joinable_now = True
            league.midseason_entry_window_number = None
            league.midseason_join_message = "Join now. Build your team before kickoff."
            filtered.append(league)
            continue

        next_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                TransferWindow.start_at > now,
            )
            .order_by(TransferWindow.start_at.asc())
            .first()
        )
        if not next_window:
            continue

        league.joinable_now = True
        league.midseason_entry_window_number = next_window.number
        league.midseason_join_message = (
            f"Join now. Your team starts scoring from transfer window {next_window.number}."
        )
        filtered.append(league)

    return filtered


def update_midseason_join_setting(
    db: Session,
    league_id: uuid.UUID,
    allow_midseason_join: bool,
    current_user: User,
) -> League:
    """Toggle whether an active budget league accepts late joiners."""
    league = _require_league(db, league_id)

    if league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can update this setting",
        )

    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mid-season joining is only available for budget leagues",
        )

    if league.status == LeagueStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update mid-season joining for completed leagues",
        )

    league.allow_midseason_join = allow_midseason_join
    db.flush()
    return _require_league(db, league_id, eager=True)


def update_league_settings(
    db: Session,
    league_id: uuid.UUID,
    *,
    name: str | None = None,
    is_public: bool | None = None,
) -> League:
    """Apply a partial update to a league's editable settings (name, visibility).

    Owner authorization is enforced at the router via require_league_owner.
    Only non-None fields are applied. Does NOT commit — caller owns the
    transaction.
    """
    league = _require_league(db, league_id)

    if name is not None:
        league.name = name
    if is_public is not None:
        league.is_public = is_public

    db.flush()
    return _require_league(db, league_id, eager=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Section 6 — Budget-mode specific functions
# ═══════════════════════════════════════════════════════════════════════════════


def generate_transfer_windows(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
) -> list[TransferWindow]:
    """Generate transfer windows for a budget-mode league.
    
    Called when transitioning from SETUP to ACTIVE for budget-mode leagues.
    Creates one transfer window per week on the league's designated transfer_day.
    
    Guards:
      1. Only the league owner can generate windows.
      2. League must be in SETUP status.
      3. League must be budget-mode (draft_mode=False).
      4. Season must have a valid date range.
    
    Returns all generated transfer windows.
    Does NOT commit — caller owns the transaction.
    """
    from datetime import datetime, timedelta, timezone
    
    league = _require_league(db, league_id)
    
    if league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can generate transfer windows",
        )
    
    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfer windows can only be generated during SETUP",
        )
    
    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfer windows are only for budget-mode leagues",
        )
    
    # Load season to get date range
    season = league.season
    if not season:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no associated season",
        )

    # Idempotency: transfer windows are unique by (season_id, number).
    # If they already exist for this season, reuse them instead of re-inserting.
    existing_windows = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == season.id)
        .order_by(TransferWindow.number.asc())
        .all()
    )
    if existing_windows:
        logger.info(
            "Transfer windows already exist for season=%s, reusing %d windows",
            season.id,
            len(existing_windows),
        )
        return existing_windows
    
    # Calculate transfer windows
    # Each window is a single day on the designated weekday
    # transfer_day: 1=Monday, 7=Sunday
    current_date = season.start_date
    window_number = 1
    windows = []
    
    # Find the first occurrence of transfer_day
    # Python weekday(): Monday=0, Sunday=6
    # Our transfer_day: Monday=1, Sunday=7
    target_weekday = (league.transfer_day - 1) % 7
    
    # Move to the first transfer day
    while current_date.weekday() != target_weekday:
        current_date += timedelta(days=1)
        if current_date > season.end_date:
            break
    
    # Generate weekly windows
    while current_date <= season.end_date:
        # Window runs for 24 hours on that day
        start_at = datetime.combine(current_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_at = start_at + timedelta(hours=23, minutes=59, seconds=59)
        
        # Deadlines anchored to the START of the gameweek: transfers + lineup
        # lock as the window opens, BEFORE its matches play, so no one can react
        # to live results. (lineup is +1 min so transfer < lineup stays strict.)
        transfer_deadline = start_at
        lineup_deadline = start_at + timedelta(minutes=1)
        
        window = TransferWindow(
            season_id=season.id,
            number=window_number,
            start_at=start_at,
            end_at=end_at,
            transfer_deadline_at=transfer_deadline,
            lineup_deadline_at=lineup_deadline,
            transfers_locked=False,
            lineup_locked=False,
        )
        db.add(window)
        windows.append(window)
        
        window_number += 1
        current_date += timedelta(weeks=1)
    
    if not windows:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No transfer windows could be generated for this season",
        )
    
    db.flush()
    logger.info(
        "Generated %d transfer windows for league=%s",
        len(windows), league_id
    )
    
    return windows


def build_initial_team(
    db: Session,
    league_id: uuid.UUID,
    team_name: str,
    player_ids: list[uuid.UUID],
    current_user: User,
) -> FantasyTeam:
    """Build initial team for a budget-mode league.
    
    Allows users to select their starting squad within budget constraints.
    Used for budget-mode leagues where there's no draft.

        Budget-mode ownership is shared across the league: another fantasy team
        can also own the same real-world player. The only ownership rule here is
        that a single fantasy team cannot include the same player twice.
    
    Guards:
      1. League must be budget-mode (draft_mode=False).
      2. League must be in SETUP status.
      3. User must be a member.
      4. User must not already have a team.
      5. All players must exist, be available, and belong to league sports.
      6. Players must not be duplicates.
      7. Total cost must not exceed budget_per_team.
      8. Number of players must match squad_size.
    
    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)
    
    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team building is only for budget-mode leagues (use draft instead)",
        )
    
    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Teams can only be built during SETUP status",
        )
    
    # Verify membership
    _require_membership(db, league_id, current_user.id)
    
    # Check if team already exists
    existing_team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == current_user.id,
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .first()
    )
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a team in this league",
        )
    
    # Derive sport type (needed for is_multisport_league flag used in team creation)
    sport_type = derive_sport_type(league.sports)
    is_multisport_league = sport_type == "mixed"

    # Fetch and validate all players exist
    players = (
        db.query(Player)
        .options(selectinload(Player.sport))
        .filter(Player.id.in_(player_ids))
        .all()
    )

    if len(players) != len(player_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more players not found",
        )

    # Get league sports
    league_sport_records = db.query(Sport).join(
        LeagueSport, LeagueSport.sport_id == Sport.id
    ).filter(LeagueSport.league_id == league_id).all()
    league_sport_ids = {s.id for s in league_sport_records}

    if not league_sport_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no sports attached",
        )

    # Validate each player's availability and sport membership
    total_cost = Decimal("0.00")
    for player in players:
        if not player.is_available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Player {player.name} is not available",
            )

        if player.sport_id not in league_sport_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Player {player.name}'s sport is not part of this league",
            )

        total_cost += player.cost

    # ── Squad size, duplicate, and mixed-sport quota validation ─────────────
    try:
        validate_squad_size(players, league, sports=league_sport_records)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # ── Position-slot validation (only when lineup slots are configured) ─────
    lineup_slots = (
        db.query(LineupSlot)
        .filter(LineupSlot.league_id == league_id)
        .all()
    )
    try:
        validate_position_slots(players, lineup_slots)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    
    # Budget check
    if total_cost > league.budget_per_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Total cost {total_cost} exceeds budget {league.budget_per_team}",
        )
    
    # Get first transfer window (needed for acquired_window_id)
    first_window = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id)
        .order_by(TransferWindow.number)
        .first()
    )
    if not first_window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No transfer windows exist for this season",
        )
    
    # Create fantasy team
    team = FantasyTeam(
        league_id=league_id,
        user_id=current_user.id,
        name=team_name,
        current_budget=league.budget_per_team - total_cost,
        starting_budget=league.budget_per_team,
        starting_squad_size=league.squad_size,
    )
    db.add(team)
    db.flush()
    
    # Add all players to the team
    for player in players:
        db.add(
            BudgetTransaction(
                fantasy_team_id=team.id,
                player_id=player.id,
                transaction_type="purchase",
                amount=player.cost,
                penalty_applied=Decimal("0.00"),
            )
        )
        team_player = TeamPlayer(
            fantasy_team_id=team.id,
            league_id=league_id,
            is_draft=league.draft_mode,
            player_id=player.id,
            sport_type=player.sport.name,
            acquired_window_id=first_window.id,
            cost_at_acquisition=player.cost,
        )
        db.add(team_player)
    
    db.flush()
    logger.info(
        "Built initial team for user=%s in league=%s with %d players (total cost: %s)",
        current_user.id, league_id, len(players), total_cost
    )
    
    return team


def get_current_draft_turn(db: Session, league_id: uuid.UUID) -> dict:
    """Return current draft turn metadata for polling clients."""
    league = _require_league(db, league_id)

    members = (
        db.query(LeagueMembership)
        .filter(LeagueMembership.league_id == league_id)
        .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .order_by(LeagueMembership.draft_position)
        .all()
    )
    n_members = len(members)
    total_picks_possible = n_members * league.squad_size if n_members else 0

    picks_made = (
        db.query(func.count(DraftPick.id))
        .filter(DraftPick.league_id == league_id)
        .scalar()
    )

    is_complete = picks_made >= total_picks_possible if total_picks_possible else False
    next_pick_number = picks_made + 1
    round_number = ((next_pick_number - 1) // n_members) + 1 if n_members else 1

    current_turn_user_id = None
    if not is_complete and n_members > 0:
        index_in_round = (next_pick_number - 1) % n_members
        # Keep existing snake behavior: odd rounds ascending, even rounds descending.
        expected_draft_pos = index_in_round + 1 if round_number % 2 == 1 else n_members - index_in_round
        picking_member = next((m for m in members if m.draft_position == expected_draft_pos), None)
        current_turn_user_id = picking_member.user_id if picking_member else None

    return {
        "league_id": league_id,
        "current_turn_user_id": current_turn_user_id,
        "next_pick_number": next_pick_number,
        "round_number": round_number,
        "is_draft_complete": is_complete,
        "total_picks_possible": total_picks_possible,
    }


def discard_team_player(
    db: Session,
    league_id: uuid.UUID,
    player_id: uuid.UUID,
    current_user: User,
) -> dict:
    """Discard player from setup budget squad and apply refund minus penalty."""
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Players can only be discarded during SETUP",
        )

    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Discard is only available in budget-mode leagues",
        )

    team = _require_fantasy_team(db, league_id, current_user.id)

    team_player = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.player_id == player_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .first()
    )
    if not team_player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player is not in your squad",
        )

    refund, penalty = calculate_refund(team_player.cost_at_acquisition)
    team.current_budget += refund

    db.add(
        BudgetTransaction(
            fantasy_team_id=team.id,
            player_id=player_id,
            transaction_type="discard",
            amount=refund,
            penalty_applied=penalty,
        )
    )

    db.delete(team_player)
    db.flush()

    return {
        "message": "Player discarded successfully",
        "refund": refund,
        "penalty_applied": penalty,
        "remaining_budget": team.current_budget,
    }


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

    if not rows:
        return

    league_season = (
        db.query(Season)
        .join(League, League.season_id == Season.id)
        .filter(League.id == league_id)
        .first()
    )
    if league_season is None:
        return

    player_ids = [team_player.player_id for team_player in rows]

    player_sport_map = dict(
        db.query(Player.id, Player.sport_id).filter(Player.id.in_(player_ids)).all()
    )
    roster_sport_ids = set(player_sport_map.values())
    sport_season_ids: dict[uuid.UUID, uuid.UUID] = {}
    for sport_id in roster_sport_ids:
        equivalent_season = find_equivalent_season_for_sport(
            db, season=league_season, sport_id=sport_id
        )
        if equivalent_season is not None:
            sport_season_ids[sport_id] = equivalent_season.id

    totals_by_player: dict[uuid.UUID, tuple[Decimal, int]] = {}
    gameweek_by_player: dict[uuid.UUID, Decimal] = {}
    now = datetime.now(timezone.utc)

    for sport_id, this_season_id in sport_season_ids.items():
        sport_player_ids = [
            pid for pid in player_ids if player_sport_map.get(pid) == sport_id
        ]
        if not sport_player_ids:
            continue

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
                TransferWindow.start_at <= now,
                TransferWindow.end_at >= now,
            )
            .order_by(TransferWindow.number.desc())
            .first()
        )
        if active_window is not None:
            for player_id, points in (
                db.query(
                    PlayerGameweekStat.player_id,
                    PlayerGameweekStat.fantasy_points,
                )
                .filter(
                    PlayerGameweekStat.transfer_window_id == active_window.id,
                    PlayerGameweekStat.player_id.in_(sport_player_ids),
                )
                .all()
            ):
                gameweek_by_player[player_id] = Decimal(points)

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


def get_active_seasons(db: Session) -> list[Season]:
    """Return all active seasons across all sports."""
    return (
        db.query(Season)
        .join(Sport, Season.sport_id == Sport.id)
        .filter(Season.is_active.is_(True))
        .filter(Sport.name.in_(SUPPORTED_LEAGUE_SPORTS))
        .order_by(Season.name.asc())
        .all()
    )


def get_active_sports(db: Session) -> list[Sport]:
    """Return all active sports available on the platform."""
    return (
        db.query(Sport)
        .filter(Sport.is_active.is_(True))
        .filter(Sport.name.in_(SUPPORTED_LEAGUE_SPORTS))
        .order_by(Sport.display_name.asc())
        .all()
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
        query = (
            db.query(
                FantasyTeam.id.label("team_id"),
                FantasyTeam.name.label("team_name"),
                User.username.label("owner_name"),
                TeamWeeklyScore.points.label("points"),
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
        total_points = func.coalesce(func.sum(TeamWeeklyScore.points), 0)
        query = (
            db.query(
                FantasyTeam.id.label("team_id"),
                FantasyTeam.name.label("team_name"),
                User.username.label("owner_name"),
                total_points.label("points"),
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
            .order_by(total_points.desc())
        )
    
    results = query.all()
    
    entries = []
    for i, row in enumerate(results):
        rank = getattr(row, "rank", None) if window_id else (i + 1)
        entries.append({
            "team_id": row.team_id,
            "team_name": row.team_name,
            "owner_name": row.owner_name,
            "points": row.points,
            "rank": rank,
        })
        
    return {
        "league_id": league_id,
        "transfer_window_id": window_id,
        "entries": entries,
    }


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


def get_active_transfer_window(db: Session, league_id: uuid.UUID) -> dict:
    """The in-progress window (containing now) — drives the live/standings
    display and scoring. For the window users EDIT, use the editable one."""
    league = _require_league(db, league_id)
    window = _current_transfer_window(db, league)
    season = league.season
    total_windows = len(season.transfer_windows) if season and season.transfer_windows else 0
    return _serialize_window(window, total_windows)


def get_editable_transfer_window(db: Session, league_id: uuid.UUID) -> dict:
    """The gameweek you can currently SET UP (the next not-yet-locked window) —
    drives the lineup + transfers pages, which edit the upcoming gameweek while
    the current one plays."""
    league = _require_league(db, league_id)
    window = _editable_transfer_window(db, league)
    season = league.season
    total_windows = len(season.transfer_windows) if season and season.transfer_windows else 0
    return _serialize_window(window, total_windows)


def get_dashboard_stats(
    db: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Return league-scoped dashboard KPIs for the authenticated user's team."""
    league = _require_league(db, league_id)
    team = _require_fantasy_team(db, league_id, user_id)

    now = datetime.now(timezone.utc)
    active_window = None
    if league.season_id:
        active_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                TransferWindow.start_at <= now,
                TransferWindow.end_at >= now,
            )
            .order_by(TransferWindow.number.desc())
            .first()
        )

    # Per-gameweek history: one row per window this team has been scored in,
    # ordered by gameweek number. The dashboard renders this directly; the
    # active-window points and the all-time total are both derived from it.
    weekly_rows = (
        db.query(
            TransferWindow.number.label("gameweek"),
            TeamWeeklyScore.transfer_window_id.label("transfer_window_id"),
            TeamWeeklyScore.points.label("points"),
            TeamWeeklyScore.rank_in_league.label("rank"),
        )
        .join(
            TransferWindow,
            TransferWindow.id == TeamWeeklyScore.transfer_window_id,
        )
        .filter(TeamWeeklyScore.fantasy_team_id == team.id)
        .order_by(TransferWindow.number.asc())
        .all()
    )

    gameweek_breakdown = [
        {
            "gameweek": row.gameweek,
            "transfer_window_id": row.transfer_window_id,
            "points": row.points,
            "rank": row.rank,
        }
        for row in weekly_rows
    ]

    gameweek_points: Decimal | None = None
    rank: int | None = None
    if active_window:
        active = next(
            (r for r in weekly_rows if r.transfer_window_id == active_window.id),
            None,
        )
        if active:
            gameweek_points = active.points
            rank = active.rank

    total_points = sum((row.points for row in weekly_rows), Decimal("0"))

    return {
        "league_id": league_id,
        "team_id": team.id,
        "rank": rank,
        "gameweek_points": gameweek_points,
        "total_points": total_points,
        "budget": team.current_budget,
        "gameweek_breakdown": gameweek_breakdown,
    }

