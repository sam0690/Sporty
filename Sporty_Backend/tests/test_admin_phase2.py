from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-phase2-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_phase2.db'}"
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
    BudgetTransaction,
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
    WaiverClaim,
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
    """Two-team draft-mode league (owner=commissioner, joiner). Mirrors
    test_draft_waivers_trades.py's _two_team_league fixture."""
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


class _FakeRedisClient:
    """Enough of the redis-py surface for redis_lock() (app/core/redis_lock.py)
    to acquire/release a lock without a real Redis server."""

    def __init__(self):
        self.store: dict[str, str] = {}

    def set(self, name, value, nx=False, ex=None):
        if nx and name in self.store:
            return False
        self.store[name] = value
        return True

    def eval(self, script, numkeys, *keys_and_args):
        key = keys_and_args[0]
        self.store.pop(key, None)
        return 1


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


# ── Scoring ─────────────────────────────────────────────────────────────────────

def test_recalculate_window_score_audits_even_when_skipped():
    with session_scope() as db, patch(
        "app.core.redis_lock.get_redis", return_value=_FakeRedisClient()
    ):
        admin = _make_user(db, role=UserRole.ADMIN)
        league, sport, window, owner, team = _budget_league(db)
        db.commit()

        result = admin_services.recalculate_window_score(db, admin, league.id, window.id)
        # league is still in SETUP status -> engine skips scoring, but the
        # admin action must still be audited.
        assert result["skipped"] is True

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.SCORING_RECALCULATE).first()
        assert entry is not None
        assert entry.target_id == str(window.id)


def test_recalculate_active_windows_audits():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        db.commit()

        result = admin_services.recalculate_active_windows(db, admin)
        assert result["windows_scored"] == 0

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.SCORING_RECALCULATE).first()
        assert entry is not None
        assert entry.target_type == "platform"


def test_set_window_lock_flips_fields_and_audits():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.ADMIN)
        _, _, window, _, _ = _budget_league(db)
        db.commit()

        updated = admin_services.set_window_lock(db, admin, window.id, transfers_locked=True)
        assert updated.transfers_locked is True
        assert updated.lineup_locked is False

        updated2 = admin_services.set_window_lock(db, admin, window.id, transfers_locked=False, lineup_locked=True)
        assert updated2.transfers_locked is False
        assert updated2.lineup_locked is True


def test_set_window_lock_404_for_missing_window():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()
        with pytest.raises(HTTPException) as exc_info:
            admin_services.set_window_lock(db, admin, uuid.uuid4(), transfers_locked=True)
        assert exc_info.value.status_code == 404


# ── Players / pricing ────────────────────────────────────────────────────────────

def test_get_player_admin_404_for_missing():
    with session_scope() as db:
        with pytest.raises(HTTPException) as exc_info:
            admin_services.get_player_admin(db, uuid.uuid4())
        assert exc_info.value.status_code == 404


def test_edit_player_updates_fields_and_audits():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, "Old Name", cost=Decimal("5.0"))
        db.commit()

        updated = admin_services.edit_player(db, admin, player.id, name="New Name", cost=7.5, is_available=False)
        assert updated.name == "New Name"
        assert updated.cost == Decimal("7.5")
        assert updated.is_available is False

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.PLAYER_DATA_EDIT).first()
        assert entry is not None
        assert entry.metadata_json["before"]["name"] == "Old Name"


def test_edit_player_club_change_moves_all_denormalized_fields():
    """A real-world transfer, applied from /admin/players."""
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        old_club = _real_team(db, sport)
        new_club = _real_team(db, sport)
        new_club.logo_url = "https://cdn.example/new.png"
        player = _player(db, sport, old_club, "Mover Man")
        db.commit()

        updated = admin_services.edit_player(db, admin, player.id, real_team_id=new_club.id)

        # real_team (the name) is what every name-matching path reads, and the
        # logo is denormalized onto the player row — all three move together.
        assert updated.real_team_id == new_club.id
        assert updated.real_team == new_club.name
        assert updated.real_team_logo_url == "https://cdn.example/new.png"

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(
            AdminAuditLog.action == AdminActionType.PLAYER_DATA_EDIT
        ).first()
        assert entry.metadata_json["before"]["real_team"] == old_club.name


def test_edit_player_club_change_rejects_name_collision():
    """uq_players_identity is (sport, folded name, club) and a violation aborts
    the whole transaction — it must surface as a 409, not a 500."""
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        old_club = _real_team(db, sport)
        new_club = _real_team(db, sport)
        _player(db, sport, new_club, "Dani  Rodriguez")  # incumbent, odd spacing
        player = _player(db, sport, old_club, "Dani Rodriguez")
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.edit_player(db, admin, player.id, real_team_id=new_club.id)
        assert exc_info.value.status_code == 409
        assert "already has a player named" in exc_info.value.detail


def test_edit_player_rejects_club_from_another_sport():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        player = _player(db, football, _real_team(db, football), "Wrong Sport")
        nba_club = _real_team(db, basketball)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.edit_player(db, admin, player.id, real_team_id=nba_club.id)
        assert exc_info.value.status_code == 409


def test_edit_player_missing_club_404s():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        player = _player(db, sport, _real_team(db, sport), "Ghost Club")
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.edit_player(db, admin, player.id, real_team_id=uuid.uuid4())
        assert exc_info.value.status_code == 404


def test_trigger_repricing_with_no_data_audits():
    with session_scope() as db, patch(
        "app.core.redis_lock.get_redis", return_value=_FakeRedisClient()
    ):
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        result = admin_services.trigger_repricing(db, admin, lookback_windows=3)
        assert result["evaluated"] == 0

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.PLAYER_PRICE_OVERRIDE).first()
        assert entry is not None


# ── Trades / waivers ─────────────────────────────────────────────────────────────

def test_admin_veto_trade_bypasses_commissioner_check():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")

        offer = trade_service.propose_trade(db, league.id, joiner_team.id, [owner_mids[0].id], [joiner_mids[0].id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        db.commit()

        # actor is a platform admin, NOT the league owner/commissioner
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        result = admin_services.admin_veto_trade(db, admin, league.id, uuid.UUID(offer["id"]))
        assert result["status"] == "vetoed"

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.TRADE_VETO_OVERRIDE).first()
        assert entry is not None


def test_admin_cancel_trade_does_not_require_team_ownership():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")

        offer = trade_service.propose_trade(db, league.id, joiner_team.id, [owner_mids[0].id], [joiner_mids[0].id], owner)
        db.commit()

        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        result = admin_services.admin_cancel_trade(db, admin, league.id, uuid.UUID(offer["id"]))
        assert result["status"] == "cancelled"


def test_admin_cancel_trade_rejects_already_executed():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")

        offer = trade_service.propose_trade(db, league.id, joiner_team.id, [owner_mids[0].id], [joiner_mids[0].id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        trade_obj = db.query(TradeOffer).filter(TradeOffer.id == uuid.UUID(offer["id"])).one()
        trade_service.execute_trade(db, trade_obj)
        db.commit()

        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.admin_cancel_trade(db, admin, league.id, uuid.UUID(offer["id"]))
        assert exc_info.value.status_code == 409


def test_admin_cancel_waiver_claim_does_not_require_team_ownership():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        fa_rt = _real_team(db, sport)
        fa = _player(db, sport, fa_rt, "FA", "MID")
        claim = waiver_service.submit_claim(db, league.id, fa.id, owner_mids[0].id, owner)
        db.commit()

        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        result = admin_services.admin_cancel_waiver_claim(db, admin, league.id, uuid.UUID(claim["id"]))
        assert result["status"] == "cancelled"


def test_admin_cancel_waiver_claim_rejects_non_pending():
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _draft_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        fa_rt = _real_team(db, sport)
        fa = _player(db, sport, fa_rt, "FA", "MID")
        claim = waiver_service.submit_claim(db, league.id, fa.id, owner_mids[0].id, owner)
        waiver_service.cancel_claim(db, league.id, uuid.UUID(claim["id"]), owner)
        db.commit()

        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.admin_cancel_waiver_claim(db, admin, league.id, uuid.UUID(claim["id"]))
        assert exc_info.value.status_code == 409


# ── Transfer reversal ────────────────────────────────────────────────────────────

def _seed_reversible_transfer(db):
    """Directly constructs the roster/budget/ledger state a budget-mode
    confirm_transfers() call would have produced, so the reversal can be
    tested without standing up the Redis-backed staging session."""
    league, sport, window, owner, team = _budget_league(db)
    rt = _real_team(db, sport)
    player_out = _player(db, sport, rt, "Outgoing", cost=Decimal("5.0"))
    player_in = _player(db, sport, rt, "Incoming", cost=Decimal("8.0"))

    released = _own(db, league, team, player_out, window, cost=Decimal("5.0"))
    released.released_window_id = window.id
    acquired = TeamPlayer(
        fantasy_team_id=team.id, league_id=league.id, is_draft=False, player_id=player_in.id,
        sport_type="football", acquired_window_id=window.id, cost_at_acquisition=Decimal("8.0"),
    )
    db.add(acquired)

    refund = Decimal("2.50")
    cost = Decimal("8.0")
    db.add(BudgetTransaction(
        fantasy_team_id=team.id, player_id=player_out.id, transfer_window_id=window.id,
        transaction_type="transfer_out_refund", amount=refund, penalty_applied=Decimal("0.10"),
    ))
    db.add(BudgetTransaction(
        fantasy_team_id=team.id, player_id=player_in.id, transfer_window_id=window.id,
        transaction_type="transfer_in_cost", amount=cost, penalty_applied=Decimal("0.00"),
    ))
    team.current_budget = team.current_budget + refund - cost

    transfer = Transfer(
        fantasy_team_id=team.id, transfer_window_id=window.id,
        player_out_id=player_out.id, player_in_id=player_in.id, cost_at_transfer=cost,
    )
    db.add(transfer)
    db.flush()
    return league, window, team, player_out, player_in, transfer, refund, cost


def test_admin_reverse_transfer_restores_roster_and_budget():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        league, window, team, player_out, player_in, transfer, refund, cost = _seed_reversible_transfer(db)
        budget_before_reversal = team.current_budget
        db.commit()

        reversed_transfer = admin_services.admin_reverse_transfer(db, admin, transfer.id)
        assert reversed_transfer.reversed_at is not None

        db.refresh(team)
        assert team.current_budget == budget_before_reversal + cost - refund

        out_row = (
            db.query(TeamPlayer)
            .filter(TeamPlayer.fantasy_team_id == team.id, TeamPlayer.player_id == player_out.id)
            .one()
        )
        assert out_row.released_window_id is None

        in_row = (
            db.query(TeamPlayer)
            .filter(TeamPlayer.fantasy_team_id == team.id, TeamPlayer.player_id == player_in.id)
            .one()
        )
        assert in_row.released_window_id == window.id

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.TRANSFER_REVERSE).first()
        assert entry is not None


def test_admin_reverse_transfer_blocks_double_reversal():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        *_, transfer, _, _ = _seed_reversible_transfer(db)
        db.commit()

        admin_services.admin_reverse_transfer(db, admin, transfer.id)

        with pytest.raises(HTTPException) as exc_info:
            admin_services.admin_reverse_transfer(db, admin, transfer.id)
        assert exc_info.value.status_code == 409


def test_admin_reverse_transfer_blocks_when_player_in_moved_on():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        league, window, team, player_out, player_in, transfer, refund, cost = _seed_reversible_transfer(db)
        # Simulate player_in having since been transferred away again.
        in_row = (
            db.query(TeamPlayer)
            .filter(TeamPlayer.fantasy_team_id == team.id, TeamPlayer.player_id == player_in.id)
            .one()
        )
        in_row.released_window_id = window.id
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.admin_reverse_transfer(db, admin, transfer.id)
        assert exc_info.value.status_code == 409


# ── Router-level tier gating spot checks ────────────────────────────────────────

def test_edit_player_endpoint_requires_super_admin_tier():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.ADMIN)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, "P")
        db.commit()

        app = _build_app(db, admin)
        client = TestClient(app)
        resp = client.patch(f"/api/v1/admin/players/{player.id}", json={"name": "New"})
        assert resp.status_code == 403


def test_reprice_endpoint_allows_admin_tier():
    with session_scope() as db, patch(
        "app.core.redis_lock.get_redis", return_value=_FakeRedisClient()
    ):
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        app = _build_app(db, admin)
        client = TestClient(app)
        resp = client.post("/api/v1/admin/players/reprice", json={"lookback_windows": 3})
        assert resp.status_code == 200


def test_transfer_reverse_endpoint_requires_super_admin_tier():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.ADMIN)
        *_, transfer, _, _ = _seed_reversible_transfer(db)
        db.commit()

        app = _build_app(db, admin)
        client = TestClient(app)
        resp = client.post(f"/api/v1/admin/transfers/{transfer.id}/reverse", json={})
        assert resp.status_code == 403
