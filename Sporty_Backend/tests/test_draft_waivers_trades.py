"""Phase 2 draft roster tests: waivers (contested resolution + rotation) and
trades (atomic swap + veto). SQLite throwaway DB, same pattern as Phase 1."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-waiver-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'wt.db'}"
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
    LeagueMembershipStatus,
    LeagueMembership,
    LeagueStatus,
    Season,
    Sport,
    TeamPlayer,
    TradeOffer,
    TransferWindow,
    WaiverOrder,
)
from app.league.schemas import LeagueCreate  # noqa: E402
from app.player.models import Player, RealTeam  # noqa: E402
from app.core.errors import DomainError  # noqa: E402
from app.services import trade_service, waiver_service  # noqa: E402

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


def _user(db, username):
    u = User(username=username, email=f"{username}@e.com",
             auth_provider=AuthProvider.LOCAL, password_hash="h")
    db.add(u); db.flush(); return u


def _window(db, season):
    w = TransferWindow(season_id=season.id, number=1, start_at=WIN_START,
                       end_at=WIN_END, transfer_deadline_at=WIN_TRANSFER_DEADLINE,
                       lineup_deadline_at=WIN_LINEUP_DEADLINE)
    db.add(w); db.flush(); return w


def _real_team(db, sport):
    rt = RealTeam(sport_id=sport.id, name=f"RT-{uuid.uuid4().hex[:6]}",
                  external_api_id=f"t:{uuid.uuid4().hex[:8]}")
    db.add(rt); db.flush(); return rt


def _player(db, sport, rt, name, position="MID"):
    p = Player(sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:10]}",
               name=name, position=position, real_team=rt.name, real_team_id=rt.id,
               cost=Decimal("5.0"), is_available=True)
    db.add(p); db.flush(); return p


def _team(db, league, user):
    t = FantasyTeam(league_id=league.id, user_id=user.id, name=f"{user.username} FC",
                    current_budget=league.budget_per_team,
                    starting_budget=league.budget_per_team,
                    starting_squad_size=league.squad_size)
    db.add(t); db.flush(); return t


def _own(db, league, team, player, window):
    tp = TeamPlayer(fantasy_team_id=team.id, league_id=league.id, is_draft=True,
                    player_id=player.id, sport_type="football",
                    acquired_window_id=window.id, cost_at_acquisition=player.cost)
    db.add(tp); db.flush(); return tp


def _valid_squad(db, league, team, sport, real_teams, window, prefix):
    """1 GK, 3 DEF, 3 MID, 1 FWD owned by team, spread across real_teams (a
    list of >=3 RealTeam rows) so no club exceeds the max-per-club cap (3).
    Returns the MID players."""
    def rt_for(i):
        return real_teams[i % len(real_teams)]

    gk = _player(db, sport, rt_for(0), f"{prefix}GK", "GKP")
    defs = [_player(db, sport, rt_for(i + 1), f"{prefix}DEF{i}", "DEF") for i in range(3)]
    mids = [_player(db, sport, rt_for(i + 4), f"{prefix}MID{i}", "MID") for i in range(3)]
    fwd = _player(db, sport, rt_for(7), f"{prefix}FWD", "FWD")
    for p in [gk, *defs, *mids, fwd]:
        _own(db, league, team, p, window)
    return mids


def _two_team_league(db):
    """Owner (draft_position 1) + joiner (draft_position 2), both with teams and
    a seeded waiver order (reverse draft order -> joiner first)."""
    owner = _user(db, "owner")
    joiner = _user(db, "joiner")
    sport = Sport(name="football", display_name="Football"); db.add(sport); db.flush()
    season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
                    start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    db.add(season); db.flush()
    window = _window(db, season)
    league = league_service.create_league(
        db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:6]}", season_id=season.id,
                         draft_mode=True, sports=["football"]), owner)
    league_service.join_league(db, league.invite_code, joiner)
    league.status = LeagueStatus.ACTIVE
    # Assign draft positions: owner=1, joiner=2
    for m in db.query(LeagueMembership).filter(LeagueMembership.league_id == league.id):
        m.draft_position = 1 if m.user_id == owner.id else 2
    db.flush()
    owner_team = _team(db, league, owner)
    joiner_team = _team(db, league, joiner)
    waiver_service.init_waiver_order(db, league)
    db.flush()
    return league, sport, window, owner, joiner, owner_team, joiner_team


def test_waiver_order_is_reverse_draft_order() -> None:
    with session_scope() as db:
        league, *_ , owner, joiner, owner_team, joiner_team = _two_team_league(db)
        order = {wo.fantasy_team_id: wo.position
                 for wo in db.query(WaiverOrder).filter(WaiverOrder.league_id == league.id)}
        # joiner drafted last (pos 2) -> first waiver priority (position 1)
        assert order[joiner_team.id] == 1
        assert order[owner_team.id] == 2


def test_contested_waiver_higher_priority_wins_and_rotates() -> None:
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")
        # Separate club so winning it can't push any club over the cap.
        fa_rt = _real_team(db, sport)
        fa = _player(db, sport, fa_rt, "FreeAgent", "MID")

        # Both teams claim the same free agent.
        waiver_service.submit_claim(db, league.id, fa.id, owner_mids[0].id, owner)
        waiver_service.submit_claim(db, league.id, fa.id, joiner_mids[0].id, joiner)

        result = waiver_service.process_waivers_for_window(db, league, window)
        db.flush()

        assert result["succeeded"] == 1 and result["failed"] == 1
        # joiner (waiver priority 1) wins the free agent
        winner = (db.query(TeamPlayer)
                  .filter(TeamPlayer.player_id == fa.id,
                          TeamPlayer.released_window_id.is_(None))
                  .one())
        assert winner.fantasy_team_id == joiner_team.id
        # owner's claim failed as "already claimed"
        from app.league.models import WaiverClaim
        owner_claim = (db.query(WaiverClaim)
                       .filter(WaiverClaim.fantasy_team_id == owner_team.id).one())
        assert owner_claim.status == "failed"
        assert "claimed" in (owner_claim.failure_reason or "").lower()
        # winner rotated to the back: owner now priority 1, joiner 2
        order = {wo.fantasy_team_id: wo.position
                 for wo in db.query(WaiverOrder).filter(WaiverOrder.league_id == league.id)}
        assert order[owner_team.id] == 1
        assert order[joiner_team.id] == 2


def test_cancel_waiver_claim() -> None:
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        fa_rt = _real_team(db, sport)
        fa = _player(db, sport, fa_rt, "FA", "MID")
        claim = waiver_service.submit_claim(db, league.id, fa.id, owner_mids[0].id, owner)
        waiver_service.cancel_claim(db, league.id, uuid.UUID(claim["id"]), owner)
        mine = waiver_service.list_my_claims(db, league.id, owner)
        assert mine[0]["status"] == "cancelled"


def test_trade_propose_accept_execute_swaps_ownership() -> None:
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")
        give = owner_mids[0]
        get = joiner_mids[0]

        offer = trade_service.propose_trade(
            db, league.id, joiner_team.id, [give.id], [get.id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        trade_obj = db.query(TradeOffer).filter(TradeOffer.id == uuid.UUID(offer["id"])).one()
        trade_service.execute_trade(db, trade_obj)
        db.flush()

        # ownership swapped
        give_now = (db.query(TeamPlayer)
                    .filter(TeamPlayer.player_id == give.id,
                            TeamPlayer.released_window_id.is_(None)).one())
        get_now = (db.query(TeamPlayer)
                   .filter(TeamPlayer.player_id == get.id,
                           TeamPlayer.released_window_id.is_(None)).one())
        assert give_now.fantasy_team_id == joiner_team.id
        assert get_now.fantasy_team_id == owner_team.id
        assert trade_obj.status == "executed"


def test_trade_veto_blocks_and_uneven_rejected() -> None:
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(3)]
        owner_mids = _valid_squad(db, league, owner_team, sport, real_teams, window, "O")
        joiner_mids = _valid_squad(db, league, joiner_team, sport, real_teams, window, "J")

        # uneven trade rejected
        with pytest.raises(HTTPException) as exc:
            trade_service.propose_trade(
                db, league.id, joiner_team.id,
                [owner_mids[0].id], [joiner_mids[0].id, joiner_mids[1].id], owner)
        assert exc.value.status_code == 409

        # commissioner veto after accept
        offer = trade_service.propose_trade(
            db, league.id, joiner_team.id, [owner_mids[0].id], [joiner_mids[0].id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        trade_service.veto_trade(db, league.id, uuid.UUID(offer["id"]), owner)  # owner = commissioner
        vetoed = db.query(TradeOffer).filter(TradeOffer.id == uuid.UUID(offer["id"])).one()
        assert vetoed.status == "vetoed"


def _full_squad(db, league, team, sport, real_teams, window, prefix):
    """A complete 15-player squad at exactly the football minimums
    (2 GKP / 5 DEF / 5 MID / 3 FWD), spread so no club exceeds the cap.
    Position rules only bite once a squad is complete, so trades can only be
    composition-tested against full squads. Returns (defs, mids)."""
    def rt_for(i):
        return real_teams[i % len(real_teams)]

    gks = [_player(db, sport, rt_for(i), f"{prefix}GK{i}", "GKP") for i in range(2)]
    defs = [_player(db, sport, rt_for(i + 2), f"{prefix}DEF{i}", "DEF") for i in range(5)]
    mids = [_player(db, sport, rt_for(i + 7), f"{prefix}MID{i}", "MID") for i in range(5)]
    fwds = [_player(db, sport, rt_for(i + 12), f"{prefix}FWD{i}", "FWD") for i in range(3)]
    for p in [*gks, *defs, *mids, *fwds]:
        _own(db, league, team, p, window)
    return defs, mids


def test_trade_revalidated_at_execution_after_roster_drift() -> None:
    """A trade legal at propose time can become illegal before it executes.

    Accepted trades sit through a 24h veto window, during which either roster
    can change (transfers, waivers, another trade, an admin position fix).
    Only propose was validated, so the drifted swap wrote an illegal squad.
    """
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(5)]
        _, owner_mids = _full_squad(db, league, owner_team, sport, real_teams, window, "O")
        _, joiner_mids = _full_squad(db, league, joiner_team, sport, real_teams, window, "J")
        give, get = owner_mids[0], joiner_mids[0]

        # MID-for-MID: both squads keep 2/5/5/3, so this passes at propose.
        offer = trade_service.propose_trade(
            db, league.id, joiner_team.id, [give.id], [get.id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        trade_obj = db.query(TradeOffer).filter(TradeOffer.id == uuid.UUID(offer["id"])).one()

        # Drift during the veto window: the incoming player is reclassified,
        # so owner would end on 6 DEF / 4 MID.
        get.position = "DEF"
        db.flush()

        with pytest.raises(DomainError, match="DEF"):
            trade_service.execute_trade(db, trade_obj)

        # Ownership untouched — the illegal swap never landed.
        still_owner = (db.query(TeamPlayer)
                       .filter(TeamPlayer.player_id == give.id,
                               TeamPlayer.released_window_id.is_(None)).one())
        assert still_owner.fantasy_team_id == owner_team.id


def test_trade_executes_when_rosters_stay_legal() -> None:
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(5)]
        _, owner_mids = _full_squad(db, league, owner_team, sport, real_teams, window, "O")
        _, joiner_mids = _full_squad(db, league, joiner_team, sport, real_teams, window, "J")
        give, get = owner_mids[0], joiner_mids[0]

        offer = trade_service.propose_trade(
            db, league.id, joiner_team.id, [give.id], [get.id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        trade_obj = db.query(TradeOffer).filter(TradeOffer.id == uuid.UUID(offer["id"])).one()
        trade_service.execute_trade(db, trade_obj)
        db.flush()

        moved = (db.query(TeamPlayer)
                 .filter(TeamPlayer.player_id == get.id,
                         TeamPlayer.released_window_id.is_(None)).one())
        assert moved.fantasy_team_id == owner_team.id
        assert trade_obj.status == "executed"


def test_finalize_marks_illegal_trade_rejected_without_aborting_sweep() -> None:
    """One drifted trade must not take the whole hourly sweep down with it."""
    with session_scope() as db:
        league, sport, window, owner, joiner, owner_team, joiner_team = _two_team_league(db)
        real_teams = [_real_team(db, sport) for _ in range(5)]
        _, owner_mids = _full_squad(db, league, owner_team, sport, real_teams, window, "O")
        _, joiner_mids = _full_squad(db, league, joiner_team, sport, real_teams, window, "J")
        give, get = owner_mids[0], joiner_mids[0]

        offer = trade_service.propose_trade(
            db, league.id, joiner_team.id, [give.id], [get.id], owner)
        trade_service.accept_trade(db, league.id, uuid.UUID(offer["id"]), joiner)
        trade_obj = db.query(TradeOffer).filter(TradeOffer.id == uuid.UUID(offer["id"])).one()
        # Veto window has lapsed, and the roster drifted while it ran.
        trade_obj.veto_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        get.position = "DEF"
        db.flush()

        result = trade_service.finalize_due_trades(db)

        assert result == {"executed": 0, "rejected": 1}
        db.refresh(trade_obj)
        assert trade_obj.status == "rejected"
