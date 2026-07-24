"""League-scoped transfers — make/stage transfers, budget-overage points penalty, transfer history.

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
from app.league.service_helpers import _TRANSFER_OPTIONS, _editable_transfer_window, _league_sport_mode, _require_fantasy_team, _require_league

logger = logging.getLogger(__name__)




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


def get_available_points_for_penalty(db: Session, fantasy_team_id: uuid.UUID) -> Decimal:
    """Points a team can spend covering a budget-overage transfer: cumulative
    finalized TeamWeeklyScore.points this season, minus penalties already
    charged. Floors at 0 — never returns negative."""
    total_points = (
        db.query(func.coalesce(func.sum(TeamWeeklyScore.points), 0))
        .filter(TeamWeeklyScore.fantasy_team_id == fantasy_team_id)
        .scalar()
    )
    total_charged = (
        db.query(func.coalesce(func.sum(PointsPenalty.points_charged), 0))
        .filter(PointsPenalty.fantasy_team_id == fantasy_team_id)
        .scalar()
    )
    return max(Decimal("0"), Decimal(total_points) - Decimal(total_charged))



def make_transfer(
    db: Session,
    league_id: uuid.UUID,
    player_out_id: uuid.UUID,
    player_in_id: uuid.UUID,
    current_user: User,
    *,
    pay_shortfall_with_points: bool = False,
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

    If the transfer would take current_budget negative, pay_shortfall_with_points
    controls what happens: False (default) raises a structured 409 the caller
    can use to show a confirm dialog; True charges the shortfall (converted
    at settings.BUDGET_OVERAGE_POINTS_RATE) against the team's available
    league points instead of blocking — see get_available_points_for_penalty().

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

    from app.league.competition_scope import ensure_player_in_league_scope

    ensure_player_in_league_scope(db, league_id, player_in)

    # ── Budget check ────────────────────────────────────────────────
    # Refund outgoing player with fixed transaction penalty.
    refund_amount, penalty = calculate_refund(team_player_out.cost_at_acquisition)
    budget_after = team.current_budget + refund_amount - player_in.cost

    points_charge: Decimal | None = None
    if budget_after < 0:
        shortfall = abs(budget_after)
        points_cost = (shortfall * settings.BUDGET_OVERAGE_POINTS_RATE).quantize(Decimal("0.01"))
        available_points = get_available_points_for_penalty(db, team.id)

        if not pay_shortfall_with_points:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "insufficient_budget",
                    "message": (
                        f"Insufficient budget: releasing gives back {refund_amount} "
                        f"(penalty {penalty}), incoming costs {player_in.cost}, "
                        f"shortfall of {shortfall}. Retry with "
                        "pay_shortfall_with_points=true to cover it with league points."
                    ),
                    "shortfall": str(shortfall),
                    "points_cost": str(points_cost),
                    "available_points": str(available_points),
                },
            )

        if points_cost > available_points:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "insufficient_points",
                    "message": (
                        f"Covering this shortfall costs {points_cost} points, "
                        f"but only {available_points} are available."
                    ),
                    "points_cost": str(points_cost),
                    "available_points": str(available_points),
                },
            )

        points_charge = points_cost
        budget_after = Decimal("0")

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

    if points_charge is not None:
        db.add(PointsPenalty(
            league_id=league_id,
            fantasy_team_id=team.id,
            transfer_window_id=window.id,
            transfer_id=transfer.id,
            points_charged=points_charge,
        ))
        db.flush()
        logger.info(
            "Transfer: team=%s charged %s points for budget overage (transfer=%s)",
            team.id, points_charge, transfer.id,
        )

    logger.info(
        "Transfer: team=%s out=%s in=%s window=%s",
        team.id, player_out_id, player_in_id, window.id,
    )

    # Re-load with eager options for Transfer response serialisation.
    # points_charged is transient (not a mapped column) — TransferResponse
    # reads it via getattr, defaulting to None when no penalty was charged.
    reloaded = (
        db.query(Transfer)
        .options(*_TRANSFER_OPTIONS)
        .filter(Transfer.id == transfer.id)
        .first()
    )
    reloaded.points_charged = points_charge
    return reloaded



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
