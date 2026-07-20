"""Live draft — turn order, pick execution, draft clock, auto-pick, draft-room pub/sub events.

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
from app.league.service_helpers import _DRAFT_PICK_OPTIONS, _league_sport_mode, _require_fantasy_team, _require_league

logger = logging.getLogger(__name__)




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



def _require_draftable_player(
    db: Session,
    league_id: uuid.UUID,
    player_id: uuid.UUID,
) -> Player:
    """Player exists, is available, belongs to a sport attached to this
    league, and has not already been drafted here. Shared by the human pick
    path (make_draft_pick) and the auto-pick candidate loop
    (select_auto_pick_player), which needs the same "still legal to draft"
    check for whichever candidate it's considering.
    """
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

    return player



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

    Guards 1-3 and 4-6 (turn ownership, player legality) are human-only —
    the live-draft-room auto-pick path (select_auto_pick_player + the Celery
    timeout task) has no current_user and instead picks on behalf of
    whichever team the turn engine says is on the clock. Guards 7-8 onward
    live in the shared _execute_draft_pick core both paths call into.

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

    player = _require_draftable_player(db, league_id, player_id)
    team = _require_fantasy_team(db, league_id, current_user.id)

    return _execute_draft_pick(db, league_id, league, team, player, turn)



def _execute_draft_pick(
    db: Session,
    league_id: uuid.UUID,
    league: League,
    team: FantasyTeam,
    player: Player,
    turn: dict,
    *,
    auto_pick: bool = False,
) -> DraftPick:
    """Shared core of a draft pick: squad constraints, DraftPick/TeamPlayer
    creation, the DRAFTING→ACTIVE auto-transition, and the live-draft-room
    pick-made broadcast. Called by make_draft_pick (human turn — turn
    ownership already validated by the caller) and the Celery auto-pick
    timeout task (system turn, no current_user to check against).

    Re-fetches `league` with a row lock (SELECT ... FOR UPDATE) and
    re-validates the turn is still the one the caller computed — the guard
    against a manual pick and an auto-pick timeout racing on the same turn.
    Whichever caller's transaction gets here first wins; the other finds the
    turn has already moved on and 409s (the Celery task treats that 409 as a
    benign no-op, not a failure — see app/tasks/draft_tasks.py).

    Does NOT commit — caller owns the transaction.
    """
    league = (
        db.query(League)
        .filter(League.id == league_id)
        .with_for_update()
        .first()
    )
    current_turn = get_current_draft_turn(db, league_id)
    if (
        current_turn["is_draft_complete"]
        or current_turn["next_pick_number"] != turn["next_pick_number"]
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This pick has already been made",
        )

    next_pick_number = int(turn["next_pick_number"])
    round_number = int(turn["round_number"])
    total_picks_possible = int(turn["total_picks_possible"])

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
        player_id=player.id,
        round_number=round_number,
        pick_number=next_pick_number,
    )
    db.add(pick)

    # Add player to the team's roster
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
        from app.services.matchup_service import generate_matchups_for_league

        db.flush()
        waiver_service.init_waiver_order(db, league)
        if league.is_head_to_head:
            generate_matchups_for_league(db, league)

    db.flush()

    _publish_draft_event(league_id, {
        "type": "draft_pick_made",
        "league_id": str(league_id),
        "pick_number": next_pick_number,
        "round_number": round_number,
        "player": {"id": str(player.id), "name": player.name, "position": player.position},
        "team": {"id": str(team.id), "name": team.name},
        "was_auto_pick": auto_pick,
    })

    # Re-load with eager options for DraftPickResponse serialisation
    return (
        db.query(DraftPick)
        .options(*_DRAFT_PICK_OPTIONS)
        .filter(DraftPick.id == pick.id)
        .first()
    )



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
        "pick_deadline_at": league.draft_pick_deadline_at,
    }



def select_auto_pick_player(
    db: Session,
    league_id: uuid.UUID,
    league: League,
    team: FantasyTeam,
) -> Player | None:
    """Highest-cost available player for `team` that passes squad
    constraints — the live-draft-room auto-pick heuristic when a manager
    misses their pick deadline. No ranking/projection system: cost is
    already the platform's proxy for player quality (same signal the ILP
    squad optimizer values on).

    # ponytail: 50-candidate cap keeps this a single cheap query + a short
    # Python loop instead of scanning the whole free-agent table. Widen (or
    # fall back to a full scan) if a real league's market is ever thin
    # enough at the top end that all 50 fail constraints — see the None
    # handling in app/tasks/draft_tasks.py for what happens when that
    # happens today (retry, not crash).
    """
    sport_type, mode = _league_sport_mode(db, league_id)
    drafted_player_ids = db.query(DraftPick.player_id).filter(DraftPick.league_id == league_id)
    candidates = (
        db.query(Player)
        .join(LeagueSport, LeagueSport.sport_id == Player.sport_id)
        .filter(
            LeagueSport.league_id == league_id,
            Player.is_available.is_(True),
            Player.id.notin_(drafted_player_ids),
        )
        .options(selectinload(Player.sport))
        .order_by(Player.cost.desc())
        .limit(50)
        .all()
    )
    current_roster = (
        db.query(TeamPlayer)
        .options(joinedload(TeamPlayer.player))
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    for candidate in candidates:
        violation = check_squad_constraints(current_roster, league, sport_type, mode, candidate)
        if violation is None:
            return candidate
    return None



def _publish_draft_event(league_id: uuid.UUID, payload: dict) -> None:
    """Fan out a draft-room event over the same Redis pub/sub channel the
    SSE endpoint (app/api/routes/sse.py) and _publish_draft_started
    (app/league/router.py) use — league:{league_id}:draft. Duplicated here
    rather than importing router.py's helper, to avoid services.py
    depending on router.py (the codebase's layering is router -> services,
    never the reverse).

    Best-effort: a Redis hiccup must never fail the pick/clock-advance it's
    reporting on.
    """
    try:
        get_redis().publish(f"league:{league_id}:draft", json.dumps(payload))
    except Exception:
        logger.exception("Failed to publish draft event for league %s: %s", league_id, payload.get("type"))



def _advance_draft_clock(db: Session, league_id: uuid.UUID) -> None:
    """Call after start_draft or any successful pick (manual or auto):
    recompute the current turn, set/clear League.draft_pick_deadline_at,
    schedule the next auto-pick timeout task, and publish the turn update
    (or draft_complete) over SSE.

    Does NOT commit — caller owns the transaction, same convention as
    every other function in this module.
    """
    league = _require_league(db, league_id)
    turn = get_current_draft_turn(db, league_id)

    if turn["is_draft_complete"]:
        league.draft_pick_deadline_at = None
        db.flush()
        _publish_draft_event(league_id, {"type": "draft_complete", "league_id": str(league_id)})
        return

    deadline = datetime.now(timezone.utc) + timedelta(seconds=league.draft_pick_seconds)
    league.draft_pick_deadline_at = deadline
    db.flush()

    from app.core.celery_app import celery_app  # lazy import — dodges the same
    # celery_app <-> task-module circular import documented in
    # app/services/scoring/trigger.py
    try:
        celery_app.send_task(
            "draft.auto_pick_timeout",
            args=[str(league_id), turn["next_pick_number"]],
            countdown=league.draft_pick_seconds,
            ignore_result=True,
        )
    except Exception:
        # A broker hiccup must not abort the pick that got us here — the
        # draft just runs without a safety-net auto-pick for this turn
        # until the next successful pick reschedules one.
        logger.exception("Failed to schedule auto-pick timeout for league %s", league_id)

    _publish_draft_event(league_id, {
        "type": "draft_turn_update",
        "league_id": str(league_id),
        "current_turn_user_id": str(turn["current_turn_user_id"]) if turn["current_turn_user_id"] else None,
        "next_pick_number": turn["next_pick_number"],
        "round_number": turn["round_number"],
        "pick_deadline_at": deadline.isoformat(),
    })
