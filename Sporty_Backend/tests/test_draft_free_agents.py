"""Phase 1 draft roster tests: free-agent pool + add/drop claim.

Runs against a throwaway SQLite DB (same pattern as the membership lifecycle
tests). The draft-ownership partial unique index is Postgres-only DDL; on SQLite
it renders as a plain unique index, which is fine here since these tests never
re-add a released player within a league.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-free-agent-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'fa.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league import services as league_service  # noqa: E402
from app.league.models import (  # noqa: E402
    FantasyTeam,
    League,
    LeagueStatus,
    RosterMove,
    Season,
    Sport,
    TeamPlayer,
    TransferWindow,
)
from app.league.schemas import LeagueCreate  # noqa: E402
from app.player.models import Player, RealTeam  # noqa: E402
from app.services import draft_roster_service as fa  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

# Clearly-future, ordered timestamps so _next_editable_window_id picks this
# window even under SQLite's lexicographic datetime-string comparison, while
# satisfying start<end and transfer_deadline<lineup_deadline check constraints.
WIN_START = datetime(2030, 1, 1, tzinfo=timezone.utc)
WIN_END = datetime(2030, 1, 8, tzinfo=timezone.utc)
WIN_TRANSFER_DEADLINE = datetime(2030, 1, 1, tzinfo=timezone.utc)
WIN_LINEUP_DEADLINE = datetime(2030, 1, 2, tzinfo=timezone.utc)


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user(db, username: str) -> User:
    u = User(
        username=username,
        email=f"{username}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed",
    )
    db.add(u)
    db.flush()
    return u


def _sport_and_season(db, name: str = "football"):
    sport = Sport(name=name, display_name=name.title())
    db.add(sport)
    db.flush()
    season = Season(
        sport_id=sport.id,
        name=f"Season-{uuid.uuid4().hex[:6]}",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(season)
    db.flush()
    return sport, season


def _window(db, season) -> TransferWindow:
    w = TransferWindow(
        season_id=season.id,
        number=1,
        start_at=WIN_START,
        end_at=WIN_END,
        transfer_deadline_at=WIN_TRANSFER_DEADLINE,
        lineup_deadline_at=WIN_LINEUP_DEADLINE,
    )
    db.add(w)
    db.flush()
    return w


def _real_team(db, sport) -> RealTeam:
    rt = RealTeam(
        sport_id=sport.id,
        name=f"Team-{uuid.uuid4().hex[:6]}",
        external_api_id=f"test:{uuid.uuid4().hex[:8]}",
    )
    db.add(rt)
    db.flush()
    return rt


def _player(db, sport, real_team, name, position="MID", cost="5.0") -> Player:
    p = Player(
        sport_id=sport.id,
        external_api_id=f"test:{uuid.uuid4().hex[:10]}",
        name=name,
        position=position,
        real_team=real_team.name,
        real_team_id=real_team.id,
        cost=Decimal(cost),
        is_available=True,
    )
    db.add(p)
    db.flush()
    return p


def _active_draft_league(db, owner, *, draft_mode=True) -> League:
    _sport, season = _sport_and_season(db)
    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:6]}",
            season_id=season.id,
            draft_mode=draft_mode,
            sports=["football"],
        ),
        owner,
    )
    league.status = LeagueStatus.ACTIVE
    db.flush()
    return league


def _own(db, league, team, player, window) -> TeamPlayer:
    tp = TeamPlayer(
        fantasy_team_id=team.id,
        league_id=league.id,
        is_draft=league.draft_mode,
        player_id=player.id,
        sport_type="football",
        acquired_window_id=window.id,
        cost_at_acquisition=player.cost,
    )
    db.add(tp)
    db.flush()
    return tp


def _team(db, league, user) -> FantasyTeam:
    t = FantasyTeam(
        league_id=league.id,
        user_id=user.id,
        name=f"{user.username} FC",
        current_budget=league.budget_per_team,
        starting_budget=league.budget_per_team,
        starting_squad_size=league.squad_size,
    )
    db.add(t)
    db.flush()
    return t


def _sport_of(db, league) -> Sport:
    return db.query(Sport).filter(Sport.name == "football").first()


def test_free_agents_excludes_owned_includes_unowned() -> None:
    with session_scope() as db:
        owner = _user(db, "owner")
        league = _active_draft_league(db, owner)
        sport = _sport_of(db, league)
        window = _window(db, db.query(Season).first())
        team = _team(db, league, owner)
        rt = _real_team(db, sport)

        owned = [_player(db, sport, rt, f"Owned{i}") for i in range(2)]
        free = [_player(db, sport, rt, f"Free{i}") for i in range(3)]
        for p in owned:
            _own(db, league, team, p, window)

        result = fa.get_free_agents(db, league.id, owner)
        names = {item["name"] for item in result["items"]}
        assert result["total"] == 3
        assert names == {"Free0", "Free1", "Free2"}


def test_claim_swaps_roster_and_logs_move() -> None:
    with session_scope() as db:
        owner = _user(db, "owner")
        league = _active_draft_league(db, owner)
        sport = _sport_of(db, league)
        window = _window(db, db.query(Season).first())
        team = _team(db, league, owner)
        rt = _real_team(db, sport)

        # A valid football squad so the swap keeps all position minimums met.
        gk = _player(db, sport, rt, "GK", position="GKP")
        defs = [_player(db, sport, rt, f"DEF{i}", position="DEF") for i in range(3)]
        mids = [_player(db, sport, rt, f"MID{i}", position="MID") for i in range(3)]
        fwd = _player(db, sport, rt, "FWD", position="FWD")
        for p in [gk, *defs, *mids, fwd]:
            _own(db, league, team, p, window)

        drop_player = mids[0]  # dropping one MID (3 -> 2, min is 2)
        add_player = _player(db, sport, rt, "AddMe", position="MID")

        result = fa.claim_free_agent(db, league.id, add_player.id, drop_player.id, owner)
        db.flush()

        assert result["status"] == "ok"
        # dropped player released, added player active
        dropped = (
            db.query(TeamPlayer)
            .filter(TeamPlayer.player_id == drop_player.id)
            .one()
        )
        assert dropped.released_window_id == window.id
        added = (
            db.query(TeamPlayer)
            .filter(
                TeamPlayer.player_id == add_player.id,
                TeamPlayer.released_window_id.is_(None),
            )
            .one()
        )
        assert added.fantasy_team_id == team.id
        assert added.is_draft is True
        # audit log written
        move = db.query(RosterMove).filter(RosterMove.league_id == league.id).one()
        assert move.move_type == "free_agent"
        assert move.add_player_id == add_player.id
        assert move.drop_player_id == drop_player.id
        assert move.actor_user_id == owner.id
        # pool now reflects the swap: added player is owned, dropped is free
        pool = {i["name"] for i in fa.get_free_agents(db, league.id, owner)["items"]}
        assert "AddMe" not in pool and "MID0" in pool


def test_claim_rejected_in_budget_league() -> None:
    with session_scope() as db:
        owner = _user(db, "owner")
        league = _active_draft_league(db, owner, draft_mode=False)
        sport = _sport_of(db, league)
        _window(db, db.query(Season).first())
        _team(db, league, owner)
        rt = _real_team(db, sport)
        p_in = _player(db, sport, rt, "In")
        p_out = _player(db, sport, rt, "Out")

        with pytest.raises(HTTPException) as exc:
            fa.claim_free_agent(db, league.id, p_in.id, p_out.id, owner)
        assert exc.value.status_code == 409
        assert "draft" in exc.value.detail.lower()


def test_claim_rejected_when_add_already_owned() -> None:
    with session_scope() as db:
        owner = _user(db, "owner")
        other = _user(db, "other")
        league = _active_draft_league(db, owner)
        sport = _sport_of(db, league)
        window = _window(db, db.query(Season).first())
        team = _team(db, league, owner)
        other_team = _team(db, league, other)
        rt = _real_team(db, sport)

        my_player = _player(db, sport, rt, "Mine", position="MID")
        _own(db, league, team, my_player, window)
        taken = _player(db, sport, rt, "Taken", position="MID")
        _own(db, league, other_team, taken, window)  # owned by another team

        with pytest.raises(HTTPException) as exc:
            fa.claim_free_agent(db, league.id, taken.id, my_player.id, owner)
        assert exc.value.status_code == 409
        assert "claimed" in exc.value.detail.lower()


def test_claim_rejected_when_drop_not_owned() -> None:
    with session_scope() as db:
        owner = _user(db, "owner")
        league = _active_draft_league(db, owner)
        sport = _sport_of(db, league)
        _window(db, db.query(Season).first())
        _team(db, league, owner)
        rt = _real_team(db, sport)

        add_player = _player(db, sport, rt, "AddMe", position="MID")
        not_owned = _player(db, sport, rt, "NotMine", position="MID")

        with pytest.raises(HTTPException) as exc:
            fa.claim_free_agent(db, league.id, add_player.id, not_owned.id, owner)
        assert exc.value.status_code == 409
        assert "drop" in exc.value.detail.lower()


def test_claim_rejected_when_position_minimum_violated() -> None:
    with session_scope() as db:
        owner = _user(db, "owner")
        league = _active_draft_league(db, owner)
        sport = _sport_of(db, league)
        window = _window(db, db.query(Season).first())
        team = _team(db, league, owner)
        rt = _real_team(db, sport)

        # Squad sits exactly at the DEF minimum (3). Dropping a DEF for a MID
        # would leave 2 DEF < min 3.
        gk = _player(db, sport, rt, "GK", position="GKP")
        defs = [_player(db, sport, rt, f"DEF{i}", position="DEF") for i in range(3)]
        mids = [_player(db, sport, rt, f"MID{i}", position="MID") for i in range(2)]
        fwd = _player(db, sport, rt, "FWD", position="FWD")
        for p in [gk, *defs, *mids, fwd]:
            _own(db, league, team, p, window)

        incoming_mid = _player(db, sport, rt, "IncomingMID", position="MID")

        with pytest.raises(HTTPException) as exc:
            fa.claim_free_agent(db, league.id, incoming_mid.id, defs[0].id, owner)
        assert exc.value.status_code == 409
        assert "DEF" in exc.value.detail
