"""League activity feed — a read-time aggregation across the three tables
that already record roster events (RosterMove, Transfer, DraftPick). No new
table: every event type already has a durable row somewhere, and this is
fundamentally a read/merge concern, not a write-path concern.

RosterMove covers draft-mode leagues (trade/waiver/free_agent/
dynasty_carryover — never 'draft', draft picks live in DraftPick instead).
Transfer covers budget-mode leagues (player swaps). DraftPick covers the
draft itself, in both modes. Nothing in these queries enforces that a
draft-mode league never has Transfer rows or vice versa — it's implicit in
which table each league mode ever writes to.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session, selectinload

from app.auth.models import User
from app.league.models import DraftPick, FantasyTeam, League, RosterMove, Transfer, TransferWindow
from app.player.models import Player

_ROSTER_MOVE_TYPES = {"trade", "waiver", "free_agent", "dynasty_carryover"}


def get_league_activity(
    db: Session,
    league: League,
    *,
    limit: int = 50,
    before: datetime | None = None,
) -> list[dict]:
    """Merged, timestamp-descending feed of this league's roster events.

    Each source is queried independently (different columns, different join
    paths, no shared timestamp column name — a raw SQL UNION would need
    per-source aliasing anyway and loses the typed rows the bulk entity
    fetch below relies on), capped at `limit` rows each, then merged and
    re-sliced in Python. Cheap for a table this size — not a hot path.
    """
    roster_move_q = db.query(RosterMove).filter(RosterMove.league_id == league.id)
    if before is not None:
        roster_move_q = roster_move_q.filter(RosterMove.created_at < before)
    roster_moves = roster_move_q.order_by(RosterMove.created_at.desc()).limit(limit).all()

    transfer_q = (
        db.query(Transfer)
        .join(FantasyTeam, Transfer.fantasy_team_id == FantasyTeam.id)
        .filter(FantasyTeam.league_id == league.id)
    )
    if before is not None:
        transfer_q = transfer_q.filter(Transfer.created_at < before)
    transfers = transfer_q.order_by(Transfer.created_at.desc()).limit(limit).all()

    draft_pick_q = db.query(DraftPick).filter(DraftPick.league_id == league.id)
    if before is not None:
        draft_pick_q = draft_pick_q.filter(DraftPick.picked_at < before)
    draft_picks = draft_pick_q.order_by(DraftPick.picked_at.desc()).limit(limit).all()

    normalized: list[dict] = []
    for rm in roster_moves:
        # move_type='draft' is allowed by the DB check constraint but no code
        # path writes it — RosterMove.move_type is always one of
        # _ROSTER_MOVE_TYPES in practice.
        normalized.append({
            "id": f"roster_move:{rm.id}",
            "type": rm.move_type,
            "created_at": rm.created_at,
            "fantasy_team_id": rm.fantasy_team_id,
            "actor_user_id": rm.actor_user_id,
            "add_player_id": rm.add_player_id,
            "drop_player_id": rm.drop_player_id,
            "window_id": rm.window_id,
            "cost_at_transfer": None,
            "round_number": None,
            "pick_number": None,
        })
    for t in transfers:
        normalized.append({
            "id": f"transfer:{t.id}",
            "type": "transfer",
            "created_at": t.created_at,
            "fantasy_team_id": t.fantasy_team_id,
            "actor_user_id": None,
            "add_player_id": t.player_in_id,
            "drop_player_id": t.player_out_id,
            "window_id": t.transfer_window_id,
            "cost_at_transfer": t.cost_at_transfer,
            "round_number": None,
            "pick_number": None,
        })
    for dp in draft_picks:
        normalized.append({
            "id": f"draft_pick:{dp.id}",
            "type": "draft_pick",
            "created_at": dp.picked_at,
            "fantasy_team_id": dp.fantasy_team_id,
            "actor_user_id": None,
            "add_player_id": dp.player_id,
            "drop_player_id": None,
            "window_id": None,
            "cost_at_transfer": None,
            "round_number": dp.round_number,
            "pick_number": dp.pick_number,
        })

    normalized.sort(key=lambda e: e["created_at"], reverse=True)
    normalized = normalized[:limit]

    # Bulk-fetch every related entity once (RosterMove has no relationship()
    # attributes at all, so this is required, not just an optimisation).
    player_ids: set[uuid.UUID] = set()
    team_ids: set[uuid.UUID] = set()
    user_ids: set[uuid.UUID] = set()
    window_ids: set[uuid.UUID] = set()
    for e in normalized:
        if e["add_player_id"]:
            player_ids.add(e["add_player_id"])
        if e["drop_player_id"]:
            player_ids.add(e["drop_player_id"])
        team_ids.add(e["fantasy_team_id"])
        if e["actor_user_id"]:
            user_ids.add(e["actor_user_id"])
        if e["window_id"]:
            window_ids.add(e["window_id"])

    players_by_id = {
        p.id: p
        for p in db.query(Player).options(selectinload(Player.sport)).filter(Player.id.in_(player_ids)).all()
    } if player_ids else {}
    teams_by_id = {
        t.id: t
        for t in db.query(FantasyTeam).options(selectinload(FantasyTeam.user)).filter(FantasyTeam.id.in_(team_ids)).all()
    } if team_ids else {}
    users_by_id = {
        u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}
    windows_by_id = {
        w.id: w for w in db.query(TransferWindow).filter(TransferWindow.id.in_(window_ids)).all()
    } if window_ids else {}

    result: list[dict] = []
    for e in normalized:
        window = windows_by_id.get(e["window_id"]) if e["window_id"] else None
        result.append({
            "id": e["id"],
            "type": e["type"],
            "created_at": e["created_at"],
            "fantasy_team": teams_by_id.get(e["fantasy_team_id"]),
            "actor": users_by_id.get(e["actor_user_id"]) if e["actor_user_id"] else None,
            "add_player": players_by_id.get(e["add_player_id"]) if e["add_player_id"] else None,
            "drop_player": players_by_id.get(e["drop_player_id"]) if e["drop_player_id"] else None,
            "window_number": window.number if window else None,
            "cost_at_transfer": e["cost_at_transfer"],
            "round_number": e["round_number"],
            "pick_number": e["pick_number"],
        })
    return result
