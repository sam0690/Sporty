"""Draft roster management — Phase 2: manager-to-manager trades.

Flow: propose → accept (opens a commissioner veto window) → finalise (atomic
ownership swap once the veto window lapses) — or reject / cancel / veto.
See docs/DRAFT_ROSTER_MANAGEMENT.md. Services never commit.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import User
from app.league.models import (
    FantasyTeam,
    League,
    LeagueSport,
    RosterMove,
    Sport,
    TeamPlayer,
)
from app.league.sportConfigs import derive_sport_type
from app.player.models import Player
from app.services import draft_roster_service as dr
from app.squad.services import check_full_squad_constraints

# Commissioner veto window after a trade is accepted, before it finalises.
VETO_HOURS = 24


def _team_by_id(db: Session, league_id: uuid.UUID, team_id: uuid.UUID) -> FantasyTeam:
    team = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.id == team_id, FantasyTeam.league_id == league_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in league")
    return team


def _active_owned(db: Session, team_id: uuid.UUID, player_ids: list[uuid.UUID]) -> dict:
    rows = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team_id,
            TeamPlayer.player_id.in_(player_ids),
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    return {r.player_id: r for r in rows}


def _sports_multiset(db: Session, player_ids: list[uuid.UUID]) -> list[str]:
    rows = db.query(Player.sport_id).filter(Player.id.in_(player_ids)).all()
    return sorted(str(r[0]) for r in rows)


def get_league_rosters(db: Session, league_id: uuid.UUID, current_user: User) -> list[dict]:
    """Every team's active roster (draft ownership is public). Used to build trades."""
    dr._require_draft_team(db, league_id, current_user)
    teams = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id)
        .all()
    )
    rows = (
        db.query(TeamPlayer, Player)
        .join(Player, Player.id == TeamPlayer.player_id)
        .filter(
            TeamPlayer.league_id == league_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    by_team: dict[uuid.UUID, list[dict]] = {}
    for tp, player in rows:
        by_team.setdefault(tp.fantasy_team_id, []).append(
            {
                "id": str(player.id),
                "name": player.name,
                "position": player.position,
                "real_team": player.real_team,
                "photo_url": player.photo_url,
                "real_team_logo_url": player.real_team_logo_url,
                "sport": player.sport.name,
            }
        )
    return [
        {
            "team_id": str(t.id),
            "team_name": t.name,
            "players": by_team.get(t.id, []),
        }
        for t in teams
    ]


def list_trades(db: Session, league_id: uuid.UUID, current_user: User) -> list[dict]:
    """Trades involving the current user's team (incoming + outgoing)."""
    from app.league.models import TradeOffer

    _, team = dr._require_draft_team(db, league_id, current_user)
    offers = (
        db.query(TradeOffer)
        .filter(
            TradeOffer.league_id == league_id,
            (TradeOffer.from_team_id == team.id) | (TradeOffer.to_team_id == team.id),
        )
        .order_by(TradeOffer.created_at.desc())
        .all()
    )
    team_names = {
        t.id: t.name for t in db.query(FantasyTeam).filter(FantasyTeam.league_id == league_id)
    }

    all_ids: set[uuid.UUID] = set()
    for o in offers:
        all_ids.update(uuid.UUID(p) for p in o.offered_player_ids)
        all_ids.update(uuid.UUID(p) for p in o.requested_player_ids)
    names = {
        p.id: p.name
        for p in db.query(Player).filter(Player.id.in_(all_ids))
    } if all_ids else {}

    def _players(ids: list[str]) -> list[dict]:
        return [{"id": pid, "name": names.get(uuid.UUID(pid), "Player")} for pid in ids]

    return [
        {
            "id": str(o.id),
            "direction": "outgoing" if o.from_team_id == team.id else "incoming",
            "from_team": {"id": str(o.from_team_id), "name": team_names.get(o.from_team_id, "")},
            "to_team": {"id": str(o.to_team_id), "name": team_names.get(o.to_team_id, "")},
            "offered": _players(o.offered_player_ids),
            "requested": _players(o.requested_player_ids),
            "status": o.status,
            "veto_deadline": o.veto_deadline.isoformat() if o.veto_deadline else None,
        }
        for o in offers
    ]


def propose_trade(
    db: Session,
    league_id: uuid.UUID,
    to_team_id: uuid.UUID,
    offered_player_ids: list[uuid.UUID],
    requested_player_ids: list[uuid.UUID],
    current_user: User,
) -> dict:
    from app.league.models import TradeOffer

    league, from_team = dr._require_draft_team(db, league_id, current_user)
    if to_team_id == from_team.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot trade with yourself")
    to_team = _team_by_id(db, league_id, to_team_id)

    if not offered_player_ids or not requested_player_ids:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Both sides must include at least one player")
    if len(offered_player_ids) != len(requested_player_ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Trades must be even (same number of players each way)",
        )

    if set(_active_owned(db, from_team.id, offered_player_ids).keys()) != set(offered_player_ids):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You do not own all offered players")
    if set(_active_owned(db, to_team.id, requested_player_ids).keys()) != set(requested_player_ids):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The other team does not own all requested players")

    # Preserve per-sport quotas: the sports swapped each way must match.
    if _sports_multiset(db, offered_player_ids) != _sports_multiset(db, requested_player_ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Traded players must match by sport on both sides",
        )

    # Max-per-club / position-minimum constraints on BOTH sides' final rosters.
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

    for team, outgoing_ids, incoming_ids in (
        (from_team, offered_player_ids, requested_player_ids),
        (to_team, requested_player_ids, offered_player_ids),
    ):
        current_roster = (
            db.query(TeamPlayer)
            .filter(
                TeamPlayer.fantasy_team_id == team.id,
                TeamPlayer.released_window_id.is_(None),
            )
            .all()
        )
        final_player_ids = {tp.player_id for tp in current_roster} - set(outgoing_ids) | set(incoming_ids)
        final_players = db.query(Player).filter(Player.id.in_(final_player_ids)).all()
        violation = check_full_squad_constraints(final_players, league, sport_type, mode)
        if violation:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=violation)

    offer = TradeOffer(
        league_id=league_id,
        from_team_id=from_team.id,
        to_team_id=to_team.id,
        offered_player_ids=[str(p) for p in offered_player_ids],
        requested_player_ids=[str(p) for p in requested_player_ids],
        status="proposed",
    )
    db.add(offer)
    db.flush()
    return {"id": str(offer.id), "status": "proposed"}


def _get_offer(db: Session, league_id: uuid.UUID, trade_id: uuid.UUID):
    from app.league.models import TradeOffer

    offer = (
        db.query(TradeOffer)
        .filter(TradeOffer.id == trade_id, TradeOffer.league_id == league_id)
        .first()
    )
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return offer


def accept_trade(db: Session, league_id: uuid.UUID, trade_id: uuid.UUID, current_user: User) -> dict:
    _, team = dr._require_draft_team(db, league_id, current_user)
    offer = _get_offer(db, league_id, trade_id)
    if offer.to_team_id != team.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the receiving manager can accept")
    if offer.status != "proposed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Trade is {offer.status}")
    offer.status = "accepted"
    offer.veto_deadline = datetime.now(timezone.utc) + timedelta(hours=VETO_HOURS)
    db.flush()
    return {"id": str(offer.id), "status": "accepted", "veto_deadline": offer.veto_deadline.isoformat()}


def reject_trade(db: Session, league_id: uuid.UUID, trade_id: uuid.UUID, current_user: User) -> dict:
    _, team = dr._require_draft_team(db, league_id, current_user)
    offer = _get_offer(db, league_id, trade_id)
    if offer.to_team_id != team.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the receiving manager can reject")
    if offer.status != "proposed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Trade is {offer.status}")
    offer.status = "rejected"
    db.flush()
    return {"id": str(offer.id), "status": "rejected"}


def cancel_trade(db: Session, league_id: uuid.UUID, trade_id: uuid.UUID, current_user: User) -> dict:
    _, team = dr._require_draft_team(db, league_id, current_user)
    offer = _get_offer(db, league_id, trade_id)
    if offer.from_team_id != team.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the proposing manager can cancel")
    if offer.status not in ("proposed", "accepted"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Trade is {offer.status}")
    offer.status = "cancelled"
    db.flush()
    return {"id": str(offer.id), "status": "cancelled"}


def veto_trade(db: Session, league_id: uuid.UUID, trade_id: uuid.UUID, current_user: User) -> dict:
    """Commissioner veto of an accepted trade before it finalises."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    if league.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the commissioner can veto")
    offer = _get_offer(db, league_id, trade_id)
    if offer.status != "accepted":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only accepted trades can be vetoed")
    offer.status = "vetoed"
    db.flush()
    return {"id": str(offer.id), "status": "vetoed"}


def _move_player(db, league, from_team, to_team, player_id, window_id):
    """Release a player from one team and grant to another, logging the move."""
    src = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == from_team.id,
            TeamPlayer.player_id == player_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .first()
    )
    if not src:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A traded player is no longer owned by the expected team",
        )
    player = db.query(Player).filter(Player.id == player_id).first()
    # Release first (and flush) so the same player_id isn't momentarily active on
    # two teams — that would trip the draft-ownership partial unique index.
    src.released_window_id = window_id
    db.flush()
    db.add(
        TeamPlayer(
            fantasy_team_id=to_team.id,
            league_id=league.id,
            is_draft=True,
            player_id=player_id,
            sport_type=player.sport.name,
            acquired_window_id=window_id,
            cost_at_acquisition=player.cost,
        )
    )
    db.add(
        RosterMove(
            league_id=league.id,
            fantasy_team_id=to_team.id,
            move_type="trade",
            add_player_id=player_id,
            drop_player_id=None,
            window_id=window_id,
            actor_user_id=None,
        )
    )


def execute_trade(db: Session, offer) -> None:
    """Atomically swap ownership for an accepted trade. Does not commit."""
    league = db.query(League).filter(League.id == offer.league_id).first()
    from_team = db.query(FantasyTeam).filter(FantasyTeam.id == offer.from_team_id).first()
    to_team = db.query(FantasyTeam).filter(FantasyTeam.id == offer.to_team_id).first()
    window_id = dr._next_editable_window_id(db, league)

    offered = [uuid.UUID(p) for p in offer.offered_player_ids]
    requested = [uuid.UUID(p) for p in offer.requested_player_ids]

    # Release everything first so re-acquisition to the other team can't trip the
    # draft-ownership unique index within the transaction.
    for pid in offered:
        _move_player(db, league, from_team, to_team, pid, window_id)
    for pid in requested:
        _move_player(db, league, to_team, from_team, pid, window_id)

    offer.status = "executed"
    db.flush()


def finalize_due_trades(db: Session) -> dict:
    """Scheduler entry point: execute accepted trades past their veto window."""
    from app.league.models import TradeOffer

    now = datetime.now(timezone.utc)
    due = (
        db.query(TradeOffer)
        .filter(TradeOffer.status == "accepted", TradeOffer.veto_deadline <= now)
        .all()
    )
    executed = 0
    for offer in due:
        execute_trade(db, offer)
        executed += 1
    return {"executed": executed}
