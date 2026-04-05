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
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.models import User
from app.league.models import (
    DraftPick,
    FantasyTeam,
    TransferWindow,
    League,
    LeagueMembership,
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
from app.player.models import Player


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
    selectinload(League.fantasy_teams),
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
        )
        .first()
    )
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You don't have a fantasy team in this league",
        )
    return team


def _current_transfer_window(db: Session, league: League) -> TransferWindow:
    """Find the current (in-progress) transfer window for the league's season.

    Raises 409 if no transfer window is active — transfers/lineups can't
    happen outside of a transfer window.
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    window = (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == league.season_id,
            TransferWindow.start_at <= now,
            TransferWindow.end_at >= now,
        )
        .first()
    )
    if not window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active transfer window — transfers are not possible right now",
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
    invite_code = _generate_invite_code(db)

    league = League(
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
        transfers_per_window=data.transfers_per_window,
        transfer_day=data.transfer_day,
    )
    db.add(league)
    db.flush()  # populate league.id for the membership FK

    # Auto-enrol owner
    membership = LeagueMembership(
        league_id=league.id,
        user_id=owner.id,
    )
    db.add(membership)
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
    return (
        db.query(League)
        .join(LeagueMembership)
        .filter(LeagueMembership.user_id == user_id)
        .options(*_LEAGUE_OPTIONS)
        .order_by(League.created_at.desc())
        .all()
    )


def update_league_status(
    db: Session,
    league_id: uuid.UUID,
    new_status: LeagueStatus,
    current_user: User,
) -> League:
    """Transition a league to a new lifecycle state.

    Valid transitions (enforced here, not at the DB level):
        SETUP     → DRAFTING
        DRAFTING  → ACTIVE
        ACTIVE    → COMPLETED
        (no backward transitions — a completed league can't revert)

    Why enforce at the service layer, not DB?
    ──────────────────────────────────────────
    A CHECK constraint can't express "old value must be X to set Y"
    because CHECK only sees the NEW row, not the old one. A trigger
    could do it, but trigger-based state machines are hard to debug
    and test. Service-layer enforcement is explicit and testable.

    Only the league OWNER can change status.
    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can change the status",
        )

    allowed_transitions: dict[LeagueStatus, LeagueStatus] = {
        LeagueStatus.SETUP: LeagueStatus.DRAFTING,
        LeagueStatus.DRAFTING: LeagueStatus.ACTIVE,
        LeagueStatus.ACTIVE: LeagueStatus.COMPLETED,
    }

    expected_next = allowed_transitions.get(league.status)
    if expected_next is None or expected_next != new_status:
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
    league = (
        db.query(League)
        .filter(League.invite_code == invite_code)
        .first()
    )
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    if league.status != LeagueStatus.SETUP:
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
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this league",
        )

    # Full?
    member_count = (
        db.query(func.count(LeagueMembership.id))
        .filter(LeagueMembership.league_id == league.id)
        .scalar()
    )
    if member_count >= league.max_teams:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league is full",
        )

    membership = LeagueMembership(
        league_id=league.id,
        user_id=user.id,
    )
    db.add(membership)
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
        )
        db.add(team)

    # c. Transition to DRAFTING
    league.status = LeagueStatus.DRAFTING
    db.flush()

    # Re-load with eager options for LeagueResponse serialisation
    return _require_league(db, league_id, eager=True)


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
      8. Player cost must not exceed the team's remaining budget.

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

    # Fetch all members ordered by draft_position
    members = (
        db.query(LeagueMembership)
        .filter(LeagueMembership.league_id == league_id)
        .order_by(LeagueMembership.draft_position)
        .all()
    )
    n_members = len(members)
    total_picks_possible = n_members * league.squad_size

    # What pick number are we on?
    picks_made = (
        db.query(func.count(DraftPick.id))
        .filter(DraftPick.league_id == league_id)
        .scalar()
    )

    if picks_made >= total_picks_possible:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft is complete — all picks have been made",
        )

    next_pick_number = picks_made + 1
    round_number = ((next_pick_number - 1) // n_members) + 1

    # Snake: odd rounds ascending, even rounds descending
    index_in_round = (next_pick_number - 1) % n_members
    if round_number % 2 == 1:
        # Odd round: draft_position 1, 2, 3, …, N
        expected_draft_pos = index_in_round + 1
    else:
        # Even round: draft_position N, N-1, …, 1
        expected_draft_pos = n_members - index_in_round

    # Whose turn is it?
    picking_member = next(
        (m for m in members if m.draft_position == expected_draft_pos),
        None,
    )
    if not picking_member or picking_member.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="It is not your turn to pick",
        )

    # Validate player
    player = db.query(Player).filter(Player.id == player_id).first()
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

    # Budget check
    if player.cost > team.current_budget:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Insufficient budget: need {player.cost}, "
                f"have {team.current_budget}"
            ),
        )

    # ── All guards passed — execute the pick ────────────────────────

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
        player_id=player_id,
        acquired_window_id=first_window.id,
        cost_at_acquisition=player.cost,
    )
    db.add(team_player)

    # Deduct cost from budget
    team.current_budget -= player.cost

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
      5. player_in exists, is available, plays a sport attached
         to this league, and is not owned by any team in this league.
      6. Team can afford player_in after refunding player_out.
      7. player_out != player_in (enforced by DB, but checked early
         for a better error message).
      8. Team has not exceeded transfers_per_window limit for this window.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfers are only allowed when the league is ACTIVE",
        )

    window = _current_transfer_window(db, league)

    if window.transfers_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfers are locked for this transfer window",
        )

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
    player_in = db.query(Player).filter(Player.id == player_in_id).first()
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

    # player_in must not be owned by any team in this league
    owned_in_league = (
        db.query(TeamPlayer)
        .join(FantasyTeam, TeamPlayer.fantasy_team_id == FantasyTeam.id)
        .filter(
            FantasyTeam.league_id == league_id,
            TeamPlayer.player_id == player_in_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .first()
    )
    if owned_in_league:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="player_in is already owned by a team in this league",
        )

    # ── Budget check ────────────────────────────────────────────────
    # Refund the outgoing player's acquisition cost, deduct incoming cost
    budget_after = (
        team.current_budget
        + team_player_out.cost_at_acquisition
        - player_in.cost
    )
    if budget_after < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Insufficient budget: releasing gives back "
                f"{team_player_out.cost_at_acquisition}, incoming costs "
                f"{player_in.cost}, shortfall of {abs(budget_after)}"
            ),
        )

    # ── Execute the transfer ────────────────────────────────────────

    # Release the outgoing player
    team_player_out.released_window_id = window.id

    # Add the incoming player
    team_player_in = TeamPlayer(
        fantasy_team_id=team.id,
        player_id=player_in_id,
        acquired_window_id=window.id,
        cost_at_acquisition=player_in.cost,
    )
    db.add(team_player_in)

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
    """Return all public leagues in SETUP status (accepting members).

    Used by the "discover leagues" UI — shows leagues anyone can browse
    and join. Only SETUP leagues are shown because once a league moves
    to DRAFTING or ACTIVE, new members can't join (they'd miss the draft).

    Ordered by newest first so fresh leagues appear at the top.
    """
    return (
        db.query(League)
        .filter(
            League.is_public == True,
            League.status == LeagueStatus.SETUP,
        )
        .options(*_LEAGUE_OPTIONS)
        .order_by(League.created_at.desc())
        .all()
    )


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
        
        # Deadlines: transfers close 2 hours before end, lineups 1 hour before end
        transfer_deadline = end_at - timedelta(hours=2)
        lineup_deadline = end_at - timedelta(hours=1)
        
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
        )
        .first()
    )
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a team in this league",
        )
    
    # Validate squad size
    if len(player_ids) != league.squad_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Must select exactly {league.squad_size} players",
        )
    
    # Check for duplicates
    if len(player_ids) != len(set(player_ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Duplicate players not allowed",
        )
    
    # Fetch and validate all players
    players = db.query(Player).filter(Player.id.in_(player_ids)).all()
    
    if len(players) != len(player_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more players not found",
        )
    
    # Get league sports
    league_sport_ids = {
        ls.sport_id
        for ls in db.query(LeagueSport).filter(LeagueSport.league_id == league_id).all()
    }
    
    if not league_sport_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no sports attached",
        )
    
    # Validate each player
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
    )
    db.add(team)
    db.flush()
    
    # Add all players to the team
    for player in players:
        team_player = TeamPlayer(
            fantasy_team_id=team.id,
            player_id=player.id,
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


def get_active_seasons(db: Session) -> list[Season]:
    """Return all active seasons across all sports."""
    return (
        db.query(Season)
        .filter(Season.is_active.is_(True))
        .order_by(Season.name.asc())
        .all()
    )


def get_active_sports(db: Session) -> list[Sport]:
    """Return all active sports available on the platform."""
    return (
        db.query(Sport)
        .filter(Sport.is_active.is_(True))
        .order_by(Sport.display_name.asc())
        .all()
    )


    return team


def get_current_lineup(db: Session, league_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    """Fetch the user's lineup for the current active transfer window."""
    team = _require_fantasy_team(db, league_id, user_id)
    league = _require_league(db, league_id)
    window = _current_transfer_window(db, league)

    entries = (
        db.query(TeamGameweekLineup)
        .filter(
            TeamGameweekLineup.fantasy_team_id == team.id,
            TeamGameweekLineup.transfer_window_id == window.id,
        )
        .options(joinedload(TeamGameweekLineup.player).joinedload(Player.sport))
        .all()
    )

    return {
        "fantasy_team_id": team.id,
        "transfer_window_id": window.id,
        "entries": entries,
    }


def update_lineup(
    db: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
    player_ids: list[uuid.UUID],
    captain_id: uuid.UUID,
    vice_captain_id: uuid.UUID,
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
    window = _current_transfer_window(db, league)

    from datetime import datetime, timezone
    if window.lineup_locked or datetime.now(timezone.utc) > window.lineup_deadline_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lineup is locked for this window",
        )

    # 1. Verify all player_ids belong to the team
    owned_player_ids = {tp.player_id for tp in team.players}
    if not all(pid in owned_player_ids for pid in player_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more players are not in your squad",
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

    # 3. Clear existing lineup for this window
    db.query(TeamGameweekLineup).filter(
        TeamGameweekLineup.fantasy_team_id == team.id,
        TeamGameweekLineup.transfer_window_id == window.id,
    ).delete()

    # 4. Create new entries
    for pid in player_ids:
        entry = TeamGameweekLineup(
            fantasy_team_id=team.id,
            transfer_window_id=window.id,
            player_id=pid,
            is_captain=(pid == captain_id),
            is_vice_captain=(pid == vice_captain_id),
        )
        db.add(entry)

    db.flush()
    logger.info(
        "Updated lineup for team=%s in window=%s (starters: %d)",
        team.id, window.id, len(player_ids)
    )

    return get_current_lineup(db, league_id, user_id)


def get_league_leaderboard(
    db: Session,
    league_id: uuid.UUID,
    window_id: uuid.UUID | None = None,
) -> dict:
    """Return the leaderboard for a league.
    
    If window_id is None, returns the sum of points across all windows
    (total season standing). If window_id is provided, returns standing
    for that specific window.
    """
    from sqlalchemy import func
    from app.league.models import FantasyTeam, TeamWeeklyScore
    from app.auth.models import User
    
    if window_id:
        # 1. Standing for a specific window
        query = (
            db.query(
                FantasyTeam.id.label("team_id"),
                FantasyTeam.name.label("team_name"),
                User.username.label("owner_name"),
                TeamWeeklyScore.points.label("points"),
                TeamWeeklyScore.rank_in_league.label("rank"),
            )
            .join(FantasyTeam, TeamWeeklyScore.fantasy_team_id == FantasyTeam.id)
            .join(User, FantasyTeam.user_id == User.id)
            .filter(FantasyTeam.league_id == league_id)
            .filter(TeamWeeklyScore.transfer_window_id == window_id)
            .order_by(TeamWeeklyScore.rank_in_league.asc(), TeamWeeklyScore.points.desc())
        )
    else:
        # 2. Total season standing (sum of points)
        query = (
            db.query(
                FantasyTeam.id.label("team_id"),
                FantasyTeam.name.label("team_name"),
                User.username.label("owner_name"),
                func.coalesce(func.sum(TeamWeeklyScore.points), 0).label("points"),
            )
            .join(User, FantasyTeam.user_id == User.id)
            .outerjoin(TeamWeeklyScore, TeamWeeklyScore.fantasy_team_id == FantasyTeam.id)
            .filter(FantasyTeam.league_id == league_id)
            .group_by(FantasyTeam.id, User.username)
            .order_by(func.desc("points"))
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


def get_active_transfer_window(db: Session, league_id: uuid.UUID) -> dict:
    """Public wrapper to fetch the current active transfer window."""
    league = _require_league(db, league_id)
    window = _current_transfer_window(db, league)
    
    # Season context for total windows
    season = league.season
    
    return {
        "id": window.id,
        "season_id": window.season_id,
        "number": window.number,
        "total_number": len(season.transfer_windows),
        "start_at": window.start_at,
        "end_at": window.end_at,
        "lineup_deadline_at": window.lineup_deadline_at,
        "lineup_locked": window.lineup_locked
    }

