"""League activity feed (app/services/league_activity_service.py) — a
read-time merge across RosterMove/Transfer/DraftPick. SQLite throwaway DB,
same pattern as test_draft_room_live.py / test_batch_scoring.py.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-league-activity-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'league_activity.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league import services as league_service  # noqa: E402
from app.league.models import (  # noqa: E402
    DraftPick,
    FantasyTeam,
    RosterMove,
    Season,
    Sport,
    Transfer,
    TransferWindow,
)
from app.league.schemas import LeagueCreate  # noqa: E402
from app.player.models import Player, RealTeam  # noqa: E402
from app.services.league_activity_service import get_league_activity  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


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
    user = User(
        username=username, email=f"{username}@example.com",
        auth_provider=AuthProvider.LOCAL, password_hash="hashed-password",
    )
    db.add(user)
    db.flush()
    return user


def _league(db, owner: User, *, draft_mode: bool, sport: Sport | None = None) -> tuple:
    # "basketball" is a lookup key into SPORT_REGISTRY elsewhere in the
    # system (squad_size derivation) — unlike League/Season names, it can't
    # be randomised per call. Share one Sport row when a test creates two
    # leagues (Sport.name is unique).
    if sport is None:
        sport = Sport(name="basketball", display_name="Basketball")
        db.add(sport)
        db.flush()
    # Unique start_date per call — Season has a (sport_id, start_date)
    # uniqueness constraint, and some tests share one Sport across leagues.
    offset = uuid.uuid4().int % 1000
    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
        start_date=date(2026, 1, 1) + timedelta(days=offset),
        end_date=date(2030, 12, 31),
    )
    db.add(season)
    db.flush()

    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}", season_id=season.id,
            draft_mode=draft_mode, sports=["basketball"],
        ),
        owner,
    )
    db.flush()

    now = datetime.now(timezone.utc)
    window = TransferWindow(
        season_id=season.id, number=1,
        start_at=now - timedelta(days=1), end_at=now + timedelta(days=6),
        transfer_deadline_at=now - timedelta(hours=1), lineup_deadline_at=now,
    )
    db.add(window)
    db.flush()

    team = FantasyTeam(
        league_id=league.id, user_id=owner.id, name="Owner FC",
        current_budget=league.budget_per_team, starting_budget=league.budget_per_team,
        starting_squad_size=league.squad_size,
    )
    db.add(team)
    db.flush()

    return league, sport, window, team


def _real_team(db, sport_id) -> RealTeam:
    # (sport_id, name) is unique — unique name per call, some tests share a sport.
    rt = RealTeam(
        sport_id=sport_id, name=f"Club-{uuid.uuid4().hex[:8]}",
        external_api_id=f"rt:{uuid.uuid4().hex[:8]}",
    )
    db.add(rt)
    db.flush()
    return rt


def _player(db, sport_id, rt: RealTeam, name: str) -> Player:
    p = Player(
        sport_id=sport_id, external_api_id=f"p:{uuid.uuid4().hex[:10]}",
        name=name, position="UNK", real_team=rt.name, real_team_id=rt.id,
        cost=Decimal("5.0"), is_available=True,
    )
    db.add(p)
    db.flush()
    return p


def test_merges_all_three_sources_in_timestamp_descending_order():
    with session_scope() as db:
        owner = _user(db, "owner")
        league, sport, window, team = _league(db, owner, draft_mode=True)
        rt = _real_team(db, sport.id)
        p1, p2, p3 = (_player(db, sport.id, rt, f"P{i}") for i in range(3))
        db.commit()

        now = datetime.now(timezone.utc)
        # Deliberately scrambled insertion order vs. timestamp order.
        db.add(Transfer(
            fantasy_team_id=team.id, transfer_window_id=window.id,
            player_out_id=p1.id, player_in_id=p2.id,
            cost_at_transfer=Decimal("6.0"), created_at=now - timedelta(minutes=5),
        ))
        db.add(RosterMove(
            league_id=league.id, fantasy_team_id=team.id, move_type="waiver",
            add_player_id=p3.id, window_id=window.id, actor_user_id=None,
            created_at=now - timedelta(minutes=1),
        ))
        db.add(DraftPick(
            league_id=league.id, fantasy_team_id=team.id, player_id=p1.id,
            round_number=1, pick_number=1, picked_at=now - timedelta(minutes=10),
        ))
        db.commit()

        events = get_league_activity(db, league, limit=50)

        assert [e["type"] for e in events] == ["waiver", "transfer", "draft_pick"]
        timestamps = [e["created_at"] for e in events]
        assert timestamps == sorted(timestamps, reverse=True)
        # Nested entities resolved via the bulk fetch, not left as raw IDs.
        assert events[0]["fantasy_team"].id == team.id
        assert events[0]["add_player"].id == p3.id


def test_before_cursor_paginates_without_repeating_events():
    with session_scope() as db:
        owner = _user(db, "owner")
        league, sport, window, team = _league(db, owner, draft_mode=True)
        db.commit()

        now = datetime.now(timezone.utc)
        for i in range(3):
            db.add(RosterMove(
                league_id=league.id, fantasy_team_id=team.id, move_type="free_agent",
                add_player_id=None, window_id=window.id, actor_user_id=owner.id,
                created_at=now - timedelta(minutes=i),
            ))
        db.commit()

        page1 = get_league_activity(db, league, limit=2)
        assert len(page1) == 2

        page2 = get_league_activity(db, league, limit=2, before=page1[-1]["created_at"])
        assert len(page2) == 1

        page1_ids = {e["id"] for e in page1}
        page2_ids = {e["id"] for e in page2}
        assert page1_ids.isdisjoint(page2_ids)


def test_draft_mode_and_budget_mode_leagues_never_leak_each_others_event_types():
    with session_scope() as db:
        owner_a = _user(db, "owner_a")
        owner_b = _user(db, "owner_b")
        draft_league, draft_sport, draft_window, draft_team = _league(db, owner_a, draft_mode=True)
        budget_league, budget_sport, budget_window, budget_team = _league(
            db, owner_b, draft_mode=False, sport=draft_sport,
        )
        rt_a = _real_team(db, draft_sport.id)
        rt_b = _real_team(db, budget_sport.id)
        pa1 = _player(db, draft_sport.id, rt_a, "DraftPlayer1")
        pb1 = _player(db, budget_sport.id, rt_b, "BudgetPlayer1")
        pb2 = _player(db, budget_sport.id, rt_b, "BudgetPlayer2")
        db.commit()

        db.add(RosterMove(
            league_id=draft_league.id, fantasy_team_id=draft_team.id, move_type="trade",
            add_player_id=pa1.id, window_id=draft_window.id, actor_user_id=owner_a.id,
        ))
        db.add(DraftPick(
            league_id=draft_league.id, fantasy_team_id=draft_team.id, player_id=pa1.id,
            round_number=1, pick_number=1,
        ))
        db.add(Transfer(
            fantasy_team_id=budget_team.id, transfer_window_id=budget_window.id,
            player_out_id=pb1.id, player_in_id=pb2.id, cost_at_transfer=Decimal("7.5"),
        ))
        db.commit()

        draft_events = get_league_activity(db, draft_league, limit=50)
        budget_events = get_league_activity(db, budget_league, limit=50)

        assert {e["type"] for e in draft_events} == {"trade", "draft_pick"}
        assert {e["type"] for e in budget_events} == {"transfer"}
