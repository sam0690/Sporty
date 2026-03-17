"""
League router — endpoints for league lifecycle, membership, draft, and transfers.

Route prefix: /leagues/...

Auth patterns:
  - get_current_active_user       → any authenticated, active user
  - require_league_member         → user must be in the league  (from league deps)
  - require_league_owner          → user must own the league    (from league deps)

Transaction convention:
  - All mutations: call service → db.commit() → return
  - All reads:     call service → return directly (no commit)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.core.redis import cache_get, cache_set
from app.database import get_db
from app.league.dependencies import require_league_member, require_league_owner
from app.league import services as league_service
from app.league.models import FantasyTeam, League, TeamWeeklyScore
from app.league.schemas import (
    DraftPickCreate,
    DraftPickResponse,
    JoinLeagueRequest,
    LeaderboardEntry,
    LeagueCreate,
    LeagueResponse,
    LeagueSportAdd,
    LeagueSportResponse,
    LineupSlotCreate,
    LineupSlotResponse,
    MembershipResponse,
    StatusUpdate,
    TeamBuildRequest,
    TransferCreate,
    TransferResponse,
)

router = APIRouter(prefix="/leagues", tags=["Leagues"])


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues/{id}/leaderboard?transfer_window_id=... (Phase 7)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{league_id}/leaderboard",
    response_model=list[LeaderboardEntry],
    summary="Get league leaderboard for a transfer window",
)
def get_league_leaderboard(
    transfer_window_id: UUID,
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
):
    """Return teams sorted by rank with team name, points, and rank.

    Cached in Redis for 60 seconds under:
      leaderboard:{league_id}:{transfer_window_id}
    """

    cache_key = f"leaderboard:{league.id}:{transfer_window_id}"
    cached = cache_get(cache_key)
    if cached and isinstance(cached, dict) and "items" in cached:
        return cached["items"]

    rows = (
        db.query(
            FantasyTeam.name,
            TeamWeeklyScore.points,
            TeamWeeklyScore.rank_in_league,
        )
        .join(TeamWeeklyScore, TeamWeeklyScore.fantasy_team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league.id)
        .filter(TeamWeeklyScore.transfer_window_id == transfer_window_id)
        .order_by(
            TeamWeeklyScore.rank_in_league.asc().nullslast(),
            TeamWeeklyScore.points.desc(),
            FantasyTeam.name.asc(),
        )
        .all()
    )

    items = [
        {
            "team_name": team_name,
            "points": str(points),
            "rank": rank_in_league,
        }
        for team_name, points, rank_in_league in rows
    ]

    cache_set(cache_key, {"items": items}, ttl_seconds=60)
    return items


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues — create a new league
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "",
    response_model=LeagueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new league",
)
def create_league(
    data: LeagueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a league and auto-enrol the creator as the first member.

    Any authenticated user can create a league. The creator becomes
    the league owner and is automatically added as a member (the owner
    must be a member to participate in the draft and set lineups).

    Returns the full league object with nested owner, season, and sports.
    """
    league = league_service.create_league(db, data, current_user)
    db.commit()
    return league


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues — list my leagues
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "",
    response_model=list[LeagueResponse],
    summary="List leagues I belong to",
)
def get_my_leagues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return every league the current user is a member of.

    Includes leagues the user owns AND leagues they've joined via
    invite code. Ordered newest first.
    """
    return league_service.get_leagues_for_user(db, current_user.id)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues/discover — browse public leagues
# ═══════════════════════════════════════════════════════════════════════════════
#
# IMPORTANT: Fixed-path routes (/discover, /join) are defined BEFORE
# /leagues/{league_id} so that FastAPI matches the literal segment
# instead of treating it as a UUID path parameter.  FastAPI evaluates
# routes in declaration order — the first match wins.


@router.get(
    "/discover",
    response_model=list[LeagueResponse],
    summary="Browse public leagues accepting members",
)
def discover_public_leagues(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return all public leagues that are still in SETUP status.

    These are the leagues anyone can browse and join. Once a league
    moves to DRAFTING or ACTIVE, it stops appearing here because
    new members can't join after the draft has started.
    """
    return league_service.discover_public_leagues(db)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/join — join a league by invite code
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/join",
    response_model=MembershipResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Join a league by invite code",
)
def join_league(
    data: JoinLeagueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Join a league using its invite code.

    Guards enforced by the service:
      - Invite code must match an existing league.
      - League must be in SETUP status (no joining mid-draft).
      - User must not already be a member.
      - League must not be full (member count < max_teams).
    """
    membership = league_service.join_league(db, data.invite_code, current_user)
    db.commit()
    return membership


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues/{league_id} — get league detail
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{league_id}",
    response_model=LeagueResponse,
    summary="Get league details",
)
def get_league(
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
):
    """Return full details for a single league.

    Why require membership instead of just authentication?
    ──────────────────────────────────────────────────────
    League details include the invite code, scoring settings,
    and member list. Exposing this to non-members leaks
    information (invite code → anyone could join a private league).
    Members already KNOW the invite code (they used it to join),
    so there's no privilege escalation.

    The require_league_member dependency already fetched the League
    row, but without eager-loaded relationships. We call the service
    to get the fully-loaded object for serialisation.
    """
    return league_service.get_league(db, league.id)


# ═══════════════════════════════════════════════════════════════════════════════
# PATCH /leagues/{league_id}/status — transition lifecycle state
# ═══════════════════════════════════════════════════════════════════════════════


@router.patch(
    "/{league_id}/status",
    response_model=LeagueResponse,
    summary="Update league status",
)
def update_status(
    data: StatusUpdate,
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Transition the league to a new lifecycle state.

    Valid transitions (linear, no rollback):
      SETUP → DRAFTING → ACTIVE → COMPLETED

    Only the league owner can change the status. The service layer
    validates the transition and raises 409 for invalid ones.

    Note: DRAFTING → ACTIVE also happens automatically when the last
    draft pick is made (see make_draft_pick). This endpoint is a
    manual override for cases like cancelling a draft.
    """
    league = league_service.update_league_status(
        db, league.id, data.new_status, current_user,
    )
    db.commit()
    return league


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/sports — attach a sport
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/sports",
    response_model=LeagueSportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a sport to the league",
)
def add_sport(
    data: LeagueSportAdd,
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
):
    """Attach a sport to the league (SETUP only).

    Uses sport_name (slug like "football") instead of a UUID.
    The service resolves the name to the internal sport ID.
    """
    league_sport = league_service.add_sport(db, league.id, data.sport_name)
    db.commit()
    return league_sport


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /leagues/{league_id}/sports/{sport_name} — detach a sport
# ═══════════════════════════════════════════════════════════════════════════════


@router.delete(
    "/{league_id}/sports/{sport_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Remove a sport from the league",
)
def remove_sport(
    sport_name: str,
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
):
    """Detach a sport from the league (SETUP only).

    Uses sport_name in the path for consistency with the add endpoint.
    Returns 204 No Content — the client already knows which sport
    was removed.
    """
    league_service.remove_sport(db, league.id, sport_name)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/lineup-slots — define position requirements
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/lineup-slots",
    response_model=LineupSlotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a lineup slot configuration",
)
def add_lineup_slot(
    data: LineupSlotCreate,
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
):
    """Define a position requirement for a sport in this league.

    Example: football → min 1 GKP, max 1 GKP.

    Only allowed during SETUP, and the sport must already be
    attached to the league.
    """
    slot = league_service.add_lineup_slot(db, league.id, data)
    db.commit()
    return slot


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues/{league_id}/members — list members
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{league_id}/members",
    response_model=list[MembershipResponse],
    summary="List league members",
)
def get_members(
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
):
    """Return all members of the league, ordered by join date.

    Why require membership, not just authentication?
    ────────────────────────────────────────────────
    Member lists are internal to a league. Exposing them to
    outsiders leaks who is playing where — minor but unnecessary.
    """
    return league_service.get_members(db, league.id)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/draft/start — start the draft
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/draft/start",
    response_model=LeagueResponse,
    summary="Start the draft",
)
def start_draft(
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Initialise the draft: randomise positions, create teams, go DRAFTING.

    Guards enforced by the service:
      - Only the owner can start the draft.
      - League must be in SETUP status.
      - At least 2 members must exist.
      - At least 1 sport must be attached.

    Each member gets a random draft_position and an auto-created
    FantasyTeam with name "{username}'s Team" and the league's
    starting budget.
    """
    league = league_service.start_draft(db, league.id, current_user)
    db.commit()
    return league


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/draft/pick — make a draft pick
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/draft/pick",
    response_model=DraftPickResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Make a draft pick",
)
def make_pick(
    data: DraftPickCreate,
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Select a player during the snake draft.

    Why DraftPickCreate (body) instead of player_id as a query param?
    ─────────────────────────────────────────────────────────────────
    POST semantics: the body IS the resource being created.
    Query params are filters/modifiers, not payloads. UUIDs in query
    strings are ugly, hard to copy, and get logged in access logs.
    A body schema also renders nicely in Swagger UI.

    The service validates turn order (snake draft), player availability,
    budget, squad size, and sport matching. If all guards pass, the
    pick is recorded and the player joins the user's team.

    When the last pick is made, the league auto-transitions from
    DRAFTING → ACTIVE.
    """
    pick = league_service.make_draft_pick(
        db, league.id, data.player_id, current_user,
    )
    db.commit()
    return pick


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/teams/build — build initial team (budget-mode)
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/teams/build",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Build initial team for budget-mode league",
)
def build_team(
    data: TeamBuildRequest,
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Build initial team for a budget-mode league.
    
    For leagues with draft_mode=False, users select their starting squad
    directly within budget constraints. This is an alternative to the
    draft process.
    
    Guards enforced by the service:
      - League must be budget-mode (draft_mode=False).
      - League must be in SETUP status.
      - User must not already have a team.
      - All players must exist, be available, and belong to league sports.
      - Total cost must not exceed budget_per_team.
      - Number of players must match squad_size.
    """
    team = league_service.build_initial_team(
        db, league.id, data.team_name, data.player_ids, current_user,
    )
    db.commit()
    return {"message": "Team created successfully", "team_id": team.id}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/transfer-windows/generate — generate transfer windows
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/transfer-windows/generate",
    response_model=dict,
    summary="Generate transfer windows for budget-mode league",
)
def generate_windows(
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate transfer windows for a budget-mode league.
    
    Creates one transfer window per week on the league's designated transfer_day.
    Used when transitioning from SETUP to ACTIVE for budget-mode leagues.
    
    Guards enforced by the service:
      - Only the league owner can generate windows.
      - League must be in SETUP status.
      - League must be budget-mode (draft_mode=False).
    """
    windows = league_service.generate_transfer_windows(db, league.id, current_user)
    db.commit()
    return {"message": f"Generated {len(windows)} transfer windows", "count": len(windows)}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/transfers — make a transfer
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{league_id}/transfers",
    response_model=TransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Make a player transfer",
)
def make_transfer(
    data: TransferCreate,
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Swap one player out of your team, bring another in.

    The service enforces:
      - League is ACTIVE.
      - Current gameweek exists and transfers aren't locked.
      - player_out is on your team; player_in is available.
      - Budget is sufficient after refunding player_out's acquisition cost.
      - Free transfer limit checked; point penalty applied if exceeded.
    """
    transfer = league_service.make_transfer(
        db, league.id, data.player_out_id, data.player_in_id, current_user,
    )
    db.commit()
    return transfer


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues/{league_id}/transfers — list transfers
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{league_id}/transfers",
    response_model=list[TransferResponse],
    summary="List all transfers in a league",
)
def get_transfers(
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
):
    """Return every transfer made in this league, newest first.

    Any league member can view transfers — transfer history is
    public within a league (you can see who your rivals traded).
    """
    return league_service.get_transfers(db, league.id)
