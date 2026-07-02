"""Draft roster management — Phase 2: waivers (FPL rolling-order, weekly).

Managers submit add/drop claims for free agents ahead of a gameweek. At the
window's waiver deadline a job resolves all pending claims in waiver_order;
winners move to the back of the order. See docs/DRAFT_ROSTER_MANAGEMENT.md.

Services never commit — the router / job owns the transaction.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.models import User
from app.league.models import (
    FantasyTeam,
    League,
    LeagueMembership,
    LeagueMembershipStatus,
    TransferWindow,
    WaiverClaim,
    WaiverOrder,
)
from app.services import draft_roster_service as dr


# ── Waiver order ─────────────────────────────────────────────────────────────


def init_waiver_order(db: Session, league: League) -> None:
    """Seed waiver order = REVERSE of draft order (last drafter picks first).
    Idempotent — a no-op if the order already exists."""
    if db.query(WaiverOrder).filter(WaiverOrder.league_id == league.id).first():
        return

    members = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == league.id,
            LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
            LeagueMembership.draft_position.is_not(None),
        )
        .order_by(LeagueMembership.draft_position.desc())
        .all()
    )
    teams = {
        t.user_id: t
        for t in db.query(FantasyTeam).filter(FantasyTeam.league_id == league.id)
    }
    position = 1
    for member in members:
        team = teams.get(member.user_id)
        if not team:
            continue
        db.add(
            WaiverOrder(
                league_id=league.id, fantasy_team_id=team.id, position=position
            )
        )
        position += 1


def get_waiver_order(db: Session, league_id: uuid.UUID, current_user: User) -> list[dict]:
    dr._require_draft_team(db, league_id, current_user)
    rows = (
        db.query(WaiverOrder, FantasyTeam)
        .join(FantasyTeam, FantasyTeam.id == WaiverOrder.fantasy_team_id)
        .filter(WaiverOrder.league_id == league_id)
        .order_by(WaiverOrder.position.asc())
        .all()
    )
    return [
        {
            "position": wo.position,
            "fantasy_team_id": str(wo.fantasy_team_id),
            "team_name": team.name,
        }
        for wo, team in rows
    ]


def _rotate_order(db: Session, league_id: uuid.UUID, winner_team_ids: list[uuid.UUID]) -> None:
    """Move winners to the back, preserving relative order on both sides."""
    if not winner_team_ids:
        return
    rows = (
        db.query(WaiverOrder)
        .filter(WaiverOrder.league_id == league_id)
        .order_by(WaiverOrder.position.asc())
        .all()
    )
    winners = set(winner_team_ids)
    kept = [r for r in rows if r.fantasy_team_id not in winners]
    moved = [r for r in rows if r.fantasy_team_id in winners]
    # Two-phase to dodge the (league_id, position) unique constraint.
    for offset, r in enumerate(rows):
        r.position = 1000 + offset
    db.flush()
    for pos, r in enumerate(kept + moved, start=1):
        r.position = pos
    db.flush()


# ── Claims ───────────────────────────────────────────────────────────────────


def submit_claim(
    db: Session,
    league_id: uuid.UUID,
    add_player_id: uuid.UUID,
    drop_player_id: uuid.UUID,
    current_user: User,
) -> dict:
    league, team = dr._require_draft_team(db, league_id, current_user)
    add_player = dr._load_player(db, add_player_id, "add")
    drop_player = dr._load_player(db, drop_player_id, "drop")

    # Validate the shape now; it's re-validated authoritatively at processing.
    # Contested free agents are allowed (multiple teams may claim the same one).
    reason, _ = dr.check_add_drop(
        db, league, team, add_player, drop_player, lock_drop=False
    )
    if reason:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=reason)

    window_id = dr._next_editable_window_id(db, league)

    existing = (
        db.query(func.count(WaiverClaim.id))
        .filter(
            WaiverClaim.fantasy_team_id == team.id,
            WaiverClaim.process_window_id == window_id,
            WaiverClaim.status == "pending",
        )
        .scalar()
    )
    waiver_pos = (
        db.query(WaiverOrder.position)
        .filter(
            WaiverOrder.league_id == league_id,
            WaiverOrder.fantasy_team_id == team.id,
        )
        .scalar()
    )
    claim = WaiverClaim(
        league_id=league_id,
        fantasy_team_id=team.id,
        add_player_id=add_player_id,
        drop_player_id=drop_player_id,
        process_window_id=window_id,
        claim_priority=existing,
        priority_snapshot=waiver_pos,
        status="pending",
    )
    db.add(claim)
    db.flush()
    return {"id": str(claim.id), "status": "pending", "claim_priority": claim.claim_priority}


def list_my_claims(db: Session, league_id: uuid.UUID, current_user: User) -> list[dict]:
    _, team = dr._require_draft_team(db, league_id, current_user)
    claims = (
        db.query(WaiverClaim)
        .filter(
            WaiverClaim.league_id == league_id,
            WaiverClaim.fantasy_team_id == team.id,
        )
        .order_by(WaiverClaim.claim_priority.asc(), WaiverClaim.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(c.id),
            "add_player_id": str(c.add_player_id),
            "drop_player_id": str(c.drop_player_id),
            "claim_priority": c.claim_priority,
            "status": c.status,
            "failure_reason": c.failure_reason,
        }
        for c in claims
    ]


def cancel_claim(
    db: Session, league_id: uuid.UUID, claim_id: uuid.UUID, current_user: User
) -> dict:
    _, team = dr._require_draft_team(db, league_id, current_user)
    claim = (
        db.query(WaiverClaim)
        .filter(
            WaiverClaim.id == claim_id,
            WaiverClaim.league_id == league_id,
            WaiverClaim.fantasy_team_id == team.id,
        )
        .first()
    )
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    if claim.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending claims can be cancelled",
        )
    claim.status = "cancelled"
    db.flush()
    return {"id": str(claim.id), "status": "cancelled"}


def reorder_claims(
    db: Session,
    league_id: uuid.UUID,
    ordered_claim_ids: list[uuid.UUID],
    current_user: User,
) -> list[dict]:
    """Set claim_priority (0-based) for this team's pending claims."""
    _, team = dr._require_draft_team(db, league_id, current_user)
    pending = {
        c.id: c
        for c in db.query(WaiverClaim).filter(
            WaiverClaim.league_id == league_id,
            WaiverClaim.fantasy_team_id == team.id,
            WaiverClaim.status == "pending",
        )
    }
    if set(ordered_claim_ids) != set(pending.keys()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Must reorder exactly your pending claims",
        )
    for priority, claim_id in enumerate(ordered_claim_ids):
        pending[claim_id].claim_priority = priority
    db.flush()
    return list_my_claims(db, league_id, current_user)


# ── Processing ───────────────────────────────────────────────────────────────


def process_waivers_for_window(
    db: Session, league: League, window: TransferWindow
) -> dict:
    """Resolve all pending claims for a window in waiver order. Winners move to
    the back of the order. Does not commit."""
    order = {
        wo.fantasy_team_id: wo.position
        for wo in db.query(WaiverOrder).filter(WaiverOrder.league_id == league.id)
    }
    claims = (
        db.query(WaiverClaim)
        .filter(
            WaiverClaim.league_id == league.id,
            WaiverClaim.process_window_id == window.id,
            WaiverClaim.status == "pending",
        )
        .all()
    )
    claims.sort(
        key=lambda c: (order.get(c.fantasy_team_id, 9999), c.claim_priority, c.created_at)
    )

    teams = {
        t.id: t for t in db.query(FantasyTeam).filter(FantasyTeam.league_id == league.id)
    }
    winners: list[uuid.UUID] = []
    succeeded = failed = 0

    for claim in claims:
        team = teams.get(claim.fantasy_team_id)
        add_player = db.query(dr.Player).filter(dr.Player.id == claim.add_player_id).first()
        drop_player = db.query(dr.Player).filter(dr.Player.id == claim.drop_player_id).first()
        if not team or not add_player or not drop_player:
            claim.status = "failed"
            claim.failure_reason = "Missing team or player"
            failed += 1
            continue

        reason, drop_tp = dr.check_add_drop(
            db, league, team, add_player, drop_player, lock_drop=False
        )
        if reason:
            claim.status = "failed"
            claim.failure_reason = reason
            failed += 1
            continue

        dr.apply_add_drop(
            db, league, team, add_player, drop_player, drop_tp, window.id,
            move_type="waiver", actor_user_id=None,
        )
        db.flush()  # subsequent ownership checks must see this add
        claim.status = "success"
        succeeded += 1
        if claim.fantasy_team_id not in winners:
            winners.append(claim.fantasy_team_id)

    _rotate_order(db, league.id, winners)
    return {"processed": len(claims), "succeeded": succeeded, "failed": failed}


def process_due_waivers(db: Session) -> dict:
    """Scheduler entry point: process pending claims for any window whose
    transfer deadline has passed. Idempotent (processed claims aren't pending)."""
    now = datetime.now(timezone.utc)
    due = (
        db.query(WaiverClaim.league_id, WaiverClaim.process_window_id)
        .join(TransferWindow, TransferWindow.id == WaiverClaim.process_window_id)
        .filter(
            WaiverClaim.status == "pending",
            TransferWindow.transfer_deadline_at <= now,
        )
        .distinct()
        .all()
    )
    total = {"windows": 0, "succeeded": 0, "failed": 0}
    for league_id, window_id in due:
        league = db.query(League).filter(League.id == league_id).first()
        window = db.query(TransferWindow).filter(TransferWindow.id == window_id).first()
        if not league or not window:
            continue
        result = process_waivers_for_window(db, league, window)
        total["windows"] += 1
        total["succeeded"] += result["succeeded"]
        total["failed"] += result["failed"]
    return total
