"""Competition scoping of league player pools.

A fantasy league can pin a sport's player pool to one real competition
(LeagueSport.competition_filter = "EPL" | "LALIGA" | "BUNDESLIGA", NULL =
all). The scope is enforced at every point a pool is materialized or a
player enters a roster: market listing, draft pool + pick validation,
auto-pick, transfers, and free agents. Trades and lineups are deliberately
unscoped — they move players already inside the league, and grandfathered
players must remain playable.

Imports models only — safe to use from both league and player services.
"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.league.models import LeagueSport, Sport
from app.player.models import Player, RealTeam


def _scoped_rows(db: Session, league_id: uuid.UUID):
    return (
        db.query(LeagueSport.sport_id, LeagueSport.competition_filter)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.competition_filter.isnot(None),
        )
        .all()
    )


def competition_scope_criterion(db: Session, league_id: uuid.UUID):
    """SQLAlchemy criterion confining players of competition-scoped league
    sports to clubs inside that competition. Returns None when nothing is
    scoped so callers can skip the filter entirely."""
    conditions = []
    for sport_id, comp in _scoped_rows(db, league_id):
        team_ids = select(RealTeam.id).where(
            RealTeam.sport_id == sport_id, RealTeam.competition == comp
        )
        conditions.append(
            or_(Player.sport_id != sport_id, Player.real_team_id.in_(team_ids))
        )
    return and_(*conditions) if conditions else None


def scoped_team_ids_by_sport_name(db: Session, league_id: uuid.UUID) -> dict[str, set[str]]:
    """{sport_name_lower: {allowed real_team id strings}} for scoped sports —
    for callers filtering an already-materialized pool (the Redis-cached
    auto-pick pool is shared across leagues, so it can't be scoped at
    fetch time)."""
    out: dict[str, set[str]] = {}
    for sport_id, comp in _scoped_rows(db, league_id):
        sport = db.query(Sport).filter(Sport.id == sport_id).first()
        if sport is None:
            continue
        ids = {
            str(tid)
            for (tid,) in db.query(RealTeam.id).filter(
                RealTeam.sport_id == sport_id, RealTeam.competition == comp
            )
        }
        out[sport.name.strip().lower()] = ids
    return out


def filter_pool_by_scope(pool: list, scoped: dict[str, set[str]]) -> list:
    """Drop pool entries whose sport is scoped and whose club is outside the
    scope. Entries need `.sport_type` and `.real_team_id` attributes."""
    if not scoped:
        return pool
    return [
        p for p in pool
        if p.sport_type not in scoped or (str(p.real_team_id or "")) in scoped[p.sport_type]
    ]


def player_in_league_scope(db: Session, league_id: uuid.UUID, player: Player) -> bool:
    """True when the player's club is inside the league's competition scope
    for their sport (or the sport is unscoped). Predicate form for callers
    that record a reason rather than raising."""
    row = (
        db.query(LeagueSport.competition_filter)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == player.sport_id,
        )
        .first()
    )
    comp = row[0] if row else None
    if comp is None:
        return True
    team = (
        db.query(RealTeam).filter(RealTeam.id == player.real_team_id).first()
        if player.real_team_id
        else None
    )
    return team is not None and team.competition == comp


def ensure_player_in_league_scope(db: Session, league_id: uuid.UUID, player: Player) -> None:
    """Raise 409 when the player's club is outside the league's competition
    scope for their sport. No-op for unscoped sports."""
    if not player_in_league_scope(db, league_id, player):
        row = (
            db.query(LeagueSport.competition_filter)
            .filter(
                LeagueSport.league_id == league_id,
                LeagueSport.sport_id == player.sport_id,
            )
            .first()
        )
        comp = row[0] if row else None
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{player.name} plays outside this league's competition scope ({comp})",
        )
