from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-ux-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_ux.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base, get_db
from app.auth.dependencies import get_current_active_user
from app.auth.models import AuthProvider, User, UserRole
import app.match.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.admin import services as admin_services
from app.admin.router import router as admin_router
from app.league import services as league_service
from app.league.models import (
    FantasyTeam,
    League,
    LeagueMembership,
    LeagueStatus,
    Season,
    Sport,
    TeamPlayer,
    TradeOffer,
    Transfer,
    TransferWindow,
)
from app.league.schemas import LeagueCreate
from app.player.models import Player, RealTeam
from app.services import trade_service, waiver_service

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

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


def _make_user(db, role: UserRole = UserRole.USER, username: str | None = None) -> User:
    username = username or f"{role.value}-{uuid.uuid4().hex[:8]}"
    user = User(
        username=username,
        email=f"{username}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _window(db, season) -> TransferWindow:
    w = TransferWindow(
        season_id=season.id, number=1, start_at=WIN_START, end_at=WIN_END,
        transfer_deadline_at=WIN_TRANSFER_DEADLINE, lineup_deadline_at=WIN_LINEUP_DEADLINE,
    )
    db.add(w)
    db.flush()
    return w


def _real_team(db, sport) -> RealTeam:
    rt = RealTeam(sport_id=sport.id, name=f"RT-{uuid.uuid4().hex[:6]}", external_api_id=f"t:{uuid.uuid4().hex[:8]}")
    db.add(rt)
    db.flush()
    return rt


def _player(db, sport, rt, name, position="MID", cost=Decimal("5.0")) -> Player:
    p = Player(
        sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:10]}", name=name,
        position=position, real_team=rt.name, real_team_id=rt.id, cost=cost, is_available=True,
    )
    db.add(p)
    db.flush()
    return p


def _fantasy_team(db, league, user) -> FantasyTeam:
    t = FantasyTeam(
        league_id=league.id, user_id=user.id, name=f"{user.username} FC",
        current_budget=league.budget_per_team, starting_budget=league.budget_per_team,
        starting_squad_size=league.squad_size,
    )
    db.add(t)
    db.flush()
    return t


def _own(db, league, team, player, window, cost=None) -> TeamPlayer:
    tp = TeamPlayer(
        fantasy_team_id=team.id, league_id=league.id, is_draft=True, player_id=player.id,
        sport_type="football", acquired_window_id=window.id,
        cost_at_acquisition=cost if cost is not None else player.cost,
    )
    db.add(tp)
    db.flush()
    return tp


def _valid_squad(db, league, team, sport, real_teams, window, prefix):
    def rt_for(i):
        return real_teams[i % len(real_teams)]

    gk = _player(db, sport, rt_for(0), f"{prefix}GK", "GKP")
    defs = [_player(db, sport, rt_for(i + 1), f"{prefix}DEF{i}", "DEF") for i in range(3)]
    mids = [_player(db, sport, rt_for(i + 4), f"{prefix}MID{i}", "MID") for i in range(3)]
    fwd = _player(db, sport, rt_for(7), f"{prefix}FWD", "FWD")
    for p in [gk, *defs, *mids, fwd]:
        _own(db, league, team, p, window)
    return mids


def _draft_league(db):
    owner = _make_user(db, username="owner")
    joiner = _make_user(db, username="joiner")
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    db.add(season)
    db.flush()
    window = _window(db, season)
    league = league_service.create_league(
        db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:6]}", season_id=season.id, draft_mode=True, sports=["football"]), owner,
    )
    league_service.join_league(db, league.invite_code, joiner)
    league.status = LeagueStatus.ACTIVE
    for m in db.query(LeagueMembership).filter(LeagueMembership.league_id == league.id):
        m.draft_position = 1 if m.user_id == owner.id else 2
    db.flush()
    owner_team = _fantasy_team(db, league, owner)
    joiner_team = _fantasy_team(db, league, joiner)
    waiver_service.init_waiver_order(db, league)
    db.flush()
    return league, sport, window, owner, joiner, owner_team, joiner_team


def _budget_league(db):
    owner = _make_user(db, username="budgetowner")
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    db.add(season)
    db.flush()
    window = _window(db, season)
    league = league_service.create_league(
        db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:6]}", season_id=season.id, draft_mode=False, sports=["football"]), owner,
    )
    team = _fantasy_team(db, league, owner)
    return league, sport, window, owner, team


def _build_app(db, user: User) -> FastAPI:
    app = FastAPI()
    app.include_router(admin_router, prefix="/api/v1")

    def _override_get_db():
        yield db

    def _override_current_user():
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_current_user
    return app


# ── Transfer windows ──────────────────────────────────────────────────────────────

def test_list_transfer_windows_for_league():
    with session_scope() as db:
        league, sport, window, owner, team = _budget_league(db)
        db.commit()

        windows = admin_services.list_transfer_windows_for_league(db, league.id)
        assert len(windows) == 1
        assert windows[0].id == window.id


def test_transfer_windows_endpoint_requires_admin_tier():
    with session_scope() as db:
        league, sport, window, owner, team = _budget_league(db)
        support_admin = _make_user(db, role=UserRole.SUPPORT)
        db.commit()

        app = _build_app(db, support_admin)
        client = TestClient(app)
        resp = client.get(f"/api/v1/admin/leagues/{league.id}/transfer-windows")
        assert resp.status_code == 403


# ── Trades ──────────────────────────────────────────────────────────────────────

def test_list_trades_for_league_filters_actionable_by_default():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")

        offer1 = trade_service.propose_trade(db, league.id, joiner_team.id, [owner_mids[0].id], [joiner_mids[0].id], owner)
        offer2 = trade_service.propose_trade(db, league.id, joiner_team.id, [owner_mids[1].id], [joiner_mids[1].id], owner)
        trade_service.reject_trade(db, league.id, uuid.UUID(offer2["id"]), joiner)
        db.commit()

        actionable = admin_services.list_trades_for_league(db, league.id, only_actionable=True)
        assert len(actionable) == 1
        assert str(actionable[0]["id"]) == offer1["id"]

        all_trades = admin_services.list_trades_for_league(db, league.id, only_actionable=False)
        assert len(all_trades) == 2


def test_list_trades_includes_team_names_and_counts():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")
        trade_service.propose_trade(db, league.id, joiner_team.id, [owner_mids[0].id], [joiner_mids[0].id], owner)
        db.commit()

        rows = admin_services.list_trades_for_league(db, league.id)
        assert rows[0]["from_team_name"] == owner_team.name
        assert rows[0]["to_team_name"] == joiner_team.name
        assert rows[0]["offered_count"] == 1
        assert rows[0]["requested_count"] == 1


# ── Waiver claims ────────────────────────────────────────────────────────────────

def test_list_waiver_claims_for_league_filters_pending_by_default():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        fa_rt = _real_team(db, sport)
        fa1 = _player(db, sport, fa_rt, "FA1", "MID")
        fa2 = _player(db, sport, fa_rt, "FA2", "MID")

        claim1 = waiver_service.submit_claim(db, league.id, fa1.id, owner_mids[0].id, owner)
        claim2 = waiver_service.submit_claim(db, league.id, fa2.id, owner_mids[1].id, owner)
        waiver_service.cancel_claim(db, league.id, uuid.UUID(claim2["id"]), owner)
        db.commit()

        pending = admin_services.list_waiver_claims_for_league(db, league.id, only_pending=True)
        assert len(pending) == 1
        assert str(pending[0]["id"]) == claim1["id"]
        assert pending[0]["add_player_name"] == "FA1"
        assert pending[0]["drop_player_name"] == "OMID0"

        all_claims = admin_services.list_waiver_claims_for_league(db, league.id, only_pending=False)
        assert len(all_claims) == 2


# ── Transfers ─────────────────────────────────────────────────────────────────────

def test_list_transfers_for_league_only_reversible_excludes_reversed():
    with session_scope() as db:
        league, sport, window, owner, team = _budget_league(db)
        rt = _real_team(db, sport)
        player_out = _player(db, sport, rt, "Outgoing", cost=Decimal("5.0"))
        player_in = _player(db, sport, rt, "Incoming", cost=Decimal("8.0"))

        transfer = Transfer(
            fantasy_team_id=team.id, transfer_window_id=window.id,
            player_out_id=player_out.id, player_in_id=player_in.id, cost_at_transfer=Decimal("8.0"),
        )
        db.add(transfer)
        db.flush()
        db.commit()

        all_transfers = admin_services.list_transfers_for_league(db, league.id, only_reversible=False)
        assert len(all_transfers) == 1
        assert all_transfers[0]["team_name"] == team.name
        assert all_transfers[0]["player_out_name"] == "Outgoing"
        assert all_transfers[0]["player_in_name"] == "Incoming"

        reversible = admin_services.list_transfers_for_league(db, league.id, only_reversible=True)
        assert len(reversible) == 1

        transfer.reversed_at = datetime.now(timezone.utc)
        db.commit()

        reversible_after = admin_services.list_transfers_for_league(db, league.id, only_reversible=True)
        assert len(reversible_after) == 0
        all_after = admin_services.list_transfers_for_league(db, league.id, only_reversible=False)
        assert len(all_after) == 1


def test_transfers_endpoint_allows_admin_tier():
    with session_scope() as db:
        league, sport, window, owner, team = _budget_league(db)
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        app = _build_app(db, admin)
        client = TestClient(app)
        resp = client.get(f"/api/v1/admin/leagues/{league.id}/transfers")
        assert resp.status_code == 200
        assert resp.json() == []
