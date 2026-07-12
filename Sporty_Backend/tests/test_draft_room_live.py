"""Live draft room — clock, auto-pick, and the make_draft_pick guards that
previously had zero direct test coverage. SQLite throwaway DB, same pattern
as test_hindsight_lineup.py / test_batch_scoring.py.

Uses basketball (not football) as the test sport: basketball has no
position-minimum quotas (SPORT_CONFIG_REGISTRY["basketball"]) so a small
squad_size doesn't trip position-minimum validation on every pick — only
max-per-club matters, and that's easy to control with distinct RealTeams.
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

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-draft-room-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'draft_room.db'}"
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
import app.tasks.draft_tasks as draft_tasks  # noqa: E402
from app.league.models import (  # noqa: E402
    DraftPick,
    FantasyTeam,
    League,
    LeagueStatus,
    Season,
    Sport,
    TransferWindow,
)
from app.league.schemas import LeagueCreate  # noqa: E402
from app.player.models import Player, RealTeam  # noqa: E402

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


@contextmanager
def _no_redis_lock(*args, **kwargs):
    # No live Redis in this test environment — the lock isn't what these
    # tests are verifying (see test_rate_limiter.py / test_batch_scoring.py
    # for the same treatment elsewhere in this suite).
    yield True


class _NoopCelery:
    def send_task(self, *args, **kwargs):
        pass


@pytest.fixture(autouse=True)
def _stub_redis_and_celery(monkeypatch):
    """Every test in this file drives DB-level logic only — no live Redis,
    no live Celery broker. _advance_draft_clock/_publish_draft_event call
    get_redis()/send_task inside try/except-log blocks (fail-open, matching
    the existing _publish_draft_started convention), so simply letting them
    fail would already be harmless, but stubbing keeps test output clean/fast.

    Two separate celery_app patch targets are needed: services.py's
    _advance_draft_clock does `from app.core.celery_app import celery_app`
    freshly on every call (lazy import), so patching the module attribute
    reaches it; draft_tasks.py imports celery_app once at module top, so its
    own module-global binding must be patched directly.
    """
    monkeypatch.setattr(league_service, "get_redis", lambda: (_ for _ in ()).throw(ConnectionError("no redis in tests")))
    monkeypatch.setattr(draft_tasks, "redis_lock", _no_redis_lock)
    fake_celery = _NoopCelery()
    import app.core.celery_app as celery_app_module
    monkeypatch.setattr(celery_app_module, "celery_app", fake_celery)
    monkeypatch.setattr(draft_tasks, "celery_app", fake_celery)


def _user(db, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed-password",
    )
    db.add(user)
    db.flush()
    return user


def _league(db, owner: User, *, squad_size: int = 2) -> League:
    sport = Sport(name="basketball", display_name="Basketball")
    db.add(sport)
    db.flush()

    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
    )
    db.add(season)
    db.flush()

    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            draft_mode=True,
            squad_size=squad_size,
            sports=["basketball"],
        ),
        owner,
    )
    # create_league normalises squad_size to the sport's canonical value
    # (SPORT_CONFIGS["basketball"]["squad_size"] == 13) regardless of what
    # was requested — that's an intentional, unrelated business rule. Force
    # it back to the small size these tests want, to keep draft-turn-math
    # tests fast without drafting 13+ players per team.
    league.squad_size = squad_size
    db.flush()

    now = datetime.now(timezone.utc)
    window = TransferWindow(
        season_id=season.id, number=1,
        start_at=now - timedelta(days=1), end_at=now + timedelta(days=6),
        transfer_deadline_at=now - timedelta(hours=1), lineup_deadline_at=now,
    )
    db.add(window)
    db.flush()

    return league


def _real_team(db, sport_id, name: str) -> RealTeam:
    rt = RealTeam(sport_id=sport_id, name=name, external_api_id=f"rt:{uuid.uuid4().hex[:8]}")
    db.add(rt)
    db.flush()
    return rt


def _player(db, sport_id, rt: RealTeam, name: str, cost: float) -> Player:
    p = Player(
        sport_id=sport_id, external_api_id=f"p:{uuid.uuid4().hex[:10]}",
        name=name, position="UNK", real_team=rt.name, real_team_id=rt.id,
        cost=Decimal(str(cost)), is_available=True,
    )
    db.add(p)
    db.flush()
    return p


def _turn_owner(db, league: League) -> User:
    """Whichever member get_current_draft_turn says is on the clock."""
    turn = league_service.get_current_draft_turn(db, league.id)
    return db.query(User).filter(User.id == turn["current_turn_user_id"]).first()


# ── get_current_draft_turn: snake-order edges ────────────────────────────


def test_snake_order_pick_one_is_ascending_round_one():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, member)
        db.commit()

        league_service.start_draft(db, league.id, owner)
        db.commit()

        turn = league_service.get_current_draft_turn(db, league.id)
        assert turn["next_pick_number"] == 1
        assert turn["round_number"] == 1
        assert turn["is_draft_complete"] is False
        assert turn["total_picks_possible"] == 4  # 2 members x squad_size 2


def test_snake_order_reverses_at_round_boundary():
    with session_scope() as db:
        owner = _user(db, "owner")
        m1 = _user(db, "m1")
        m2 = _user(db, "m2")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, m1)
        league_service.join_league(db, league.invite_code, m2)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")

        # 3 members -> round 1 = picks 1-3 (ascending draft_position), round
        # 2 = picks 4-6 (descending). Drain round 1 by picking as whoever is
        # actually on the clock each time (draft_position is randomised).
        first_round_pickers = []
        for i in range(3):
            picker = _turn_owner(db, league)
            first_round_pickers.append(picker.username)
            player = _player(db, sport.id, rt, f"P{i}", 5.0 + i)
            league_service.make_draft_pick(db, league.id, player.id, picker)
            db.commit()

        turn = league_service.get_current_draft_turn(db, league.id)
        assert turn["round_number"] == 2
        assert turn["next_pick_number"] == 4
        # Snake reversal: round 2's first picker is round 1's LAST picker.
        round2_picker = _turn_owner(db, league)
        assert round2_picker.username == first_round_pickers[-1]


def test_draft_complete_boundary():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=1)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")

        for i in range(2):  # 2 members x squad_size 1 = 2 total picks
            picker = _turn_owner(db, league)
            player = _player(db, sport.id, rt, f"P{i}", 5.0)
            league_service.make_draft_pick(db, league.id, player.id, picker)
            db.commit()

        turn = league_service.get_current_draft_turn(db, league.id)
        assert turn["is_draft_complete"] is True


# ── make_draft_pick guards ───────────────────────────────────────────────


def test_make_draft_pick_rejects_when_not_your_turn():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")
        player = _player(db, sport.id, rt, "P1", 5.0)

        on_clock = _turn_owner(db, league)
        not_on_clock = member if on_clock.id == owner.id else owner

        with pytest.raises(HTTPException) as exc:
            league_service.make_draft_pick(db, league.id, player.id, not_on_clock)
        assert exc.value.status_code == 409
        assert "not your turn" in exc.value.detail.lower()


def test_make_draft_pick_rejects_already_drafted_player():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")
        player = _player(db, sport.id, rt, "P1", 5.0)

        first_picker = _turn_owner(db, league)
        league_service.make_draft_pick(db, league.id, player.id, first_picker)
        db.commit()

        second_picker = _turn_owner(db, league)
        with pytest.raises(HTTPException) as exc:
            league_service.make_draft_pick(db, league.id, player.id, second_picker)
        assert exc.value.status_code == 409
        assert "already been drafted" in exc.value.detail.lower()


def test_make_draft_pick_rejects_player_from_unattached_sport():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        other_sport = Sport(name="football", display_name="Football")
        db.add(other_sport)
        db.flush()
        rt = _real_team(db, other_sport.id, "Club A")
        player = _player(db, other_sport.id, rt, "P1", 5.0)

        picker = _turn_owner(db, league)
        with pytest.raises(HTTPException) as exc:
            league_service.make_draft_pick(db, league.id, player.id, picker)
        assert exc.value.status_code == 409
        assert "sport is not part of this league" in exc.value.detail.lower()


def test_make_draft_pick_rejects_when_squad_already_full():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=1)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")

        picker = _turn_owner(db, league)
        team = db.query(FantasyTeam).filter(
            FantasyTeam.league_id == league.id, FantasyTeam.user_id == picker.id,
        ).first()
        # Manually fill the squad past its size without going through the
        # normal pick flow, to exercise the guard directly.
        from app.league.models import TeamPlayer
        filler = _player(db, sport.id, rt, "Filler", 4.0)
        db.add(TeamPlayer(
            fantasy_team_id=team.id, league_id=league.id, is_draft=True,
            player_id=filler.id, sport_type="basketball",
            acquired_window_id=db.query(TransferWindow).first().id,
            cost_at_acquisition=filler.cost,
        ))
        db.commit()

        player = _player(db, sport.id, rt, "P1", 5.0)
        with pytest.raises(HTTPException) as exc:
            league_service.make_draft_pick(db, league.id, player.id, picker)
        assert exc.value.status_code == 409
        assert "squad is already full" in exc.value.detail.lower()


def test_make_draft_pick_success_auto_transitions_league_to_active():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=1)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")

        for i in range(2):
            picker = _turn_owner(db, league)
            player = _player(db, sport.id, rt, f"P{i}", 5.0)
            pick = league_service.make_draft_pick(db, league.id, player.id, picker)
            db.commit()
            assert pick.player_id == player.id

        db.expire_all()
        refreshed = db.query(League).filter(League.id == league.id).first()
        assert refreshed.status == LeagueStatus.ACTIVE
        assert db.query(DraftPick).filter(DraftPick.league_id == league.id).count() == 2


# ── select_auto_pick_player ──────────────────────────────────────────────


def test_select_auto_pick_player_skips_club_cap_violation():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=10)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        capped_club = _real_team(db, sport.id, "Capped FC")
        open_club = _real_team(db, sport.id, "Open FC")

        picker = _turn_owner(db, league)
        team = db.query(FantasyTeam).filter(
            FantasyTeam.league_id == league.id, FantasyTeam.user_id == picker.id,
        ).first()
        from app.league.models import TeamPlayer
        window_id = db.query(TransferWindow).first().id
        for i in range(3):  # DEFAULT_MAX_PER_CLUB = 3, already at the cap
            p = _player(db, sport.id, capped_club, f"Capped{i}", 9.0)
            db.add(TeamPlayer(
                fantasy_team_id=team.id, league_id=league.id, is_draft=True,
                player_id=p.id, sport_type="basketball",
                acquired_window_id=window_id, cost_at_acquisition=p.cost,
            ))
        db.commit()

        # Highest-cost available player is from the already-capped club —
        # must be skipped in favour of the next-highest from an open club.
        _player(db, sport.id, capped_club, "TooExpensive", 20.0)
        expected = _player(db, sport.id, open_club, "ShouldPick", 15.0)
        db.commit()

        league = db.query(League).filter(League.id == league.id).first()
        chosen = league_service.select_auto_pick_player(db, league.id, league, team)
        assert chosen is not None
        assert chosen.id == expected.id


def test_select_auto_pick_player_returns_none_when_all_candidates_fail():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=10)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        capped_club = _real_team(db, sport.id, "Capped FC")

        picker = _turn_owner(db, league)
        team = db.query(FantasyTeam).filter(
            FantasyTeam.league_id == league.id, FantasyTeam.user_id == picker.id,
        ).first()
        from app.league.models import TeamPlayer
        window_id = db.query(TransferWindow).first().id
        for i in range(3):
            p = _player(db, sport.id, capped_club, f"Capped{i}", 9.0)
            db.add(TeamPlayer(
                fantasy_team_id=team.id, league_id=league.id, is_draft=True,
                player_id=p.id, sport_type="basketball",
                acquired_window_id=window_id, cost_at_acquisition=p.cost,
            ))
        db.commit()

        # Only remaining undrafted players are from the already-capped club.
        _player(db, sport.id, capped_club, "AlsoCapped1", 8.0)
        _player(db, sport.id, capped_club, "AlsoCapped2", 7.0)
        db.commit()

        league = db.query(League).filter(League.id == league.id).first()
        chosen = league_service.select_auto_pick_player(db, league.id, league, team)
        assert chosen is None


# ── auto_pick_timeout_task idempotency ───────────────────────────────────


def test_auto_pick_timeout_task_no_ops_when_turn_already_advanced():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")

        # Manually advance the turn to pick 2 before the "stale" task for
        # pick 1 fires.
        picker = _turn_owner(db, league)
        player = _player(db, sport.id, rt, "P1", 5.0)
        league_service.make_draft_pick(db, league.id, player.id, picker)
        db.commit()

        picks_before = db.query(DraftPick).filter(DraftPick.league_id == league.id).count()

        # The task opens its OWN session (SessionLocal()) rather than
        # reusing this test's — reusing it would let the task's `finally:
        # db.close()` close the session out from under this test. Point the
        # task's SessionLocal at this file's own sessionmaker (same ENGINE,
        # same underlying sqlite file) instead, and call the Task instance
        # directly — Celery runs it synchronously in-process, no broker
        # needed, standard way to unit-test a task body.
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(draft_tasks, "SessionLocal", SessionLocal)
        try:
            result = draft_tasks.auto_pick_timeout_task(str(league.id), 1)
        finally:
            monkeypatch.undo()

        assert result == {"skipped": "turn_already_advanced"}
        db.expire_all()
        assert db.query(DraftPick).filter(DraftPick.league_id == league.id).count() == picks_before


def test_auto_pick_timeout_task_picks_for_the_team_on_the_clock():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        league = _league(db, owner, squad_size=2)
        league_service.join_league(db, league.invite_code, member)
        db.commit()
        league_service.start_draft(db, league.id, owner)
        db.commit()

        sport = db.query(Sport).first()
        rt = _real_team(db, sport.id, "Club A")
        _player(db, sport.id, rt, "BestAvailable", 12.0)
        db.commit()

        turn = league_service.get_current_draft_turn(db, league.id)
        assert turn["next_pick_number"] == 1

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(draft_tasks, "SessionLocal", SessionLocal)
        try:
            result = draft_tasks.auto_pick_timeout_task(str(league.id), 1)
        finally:
            monkeypatch.undo()

        assert "auto_picked" in result
        db.expire_all()
        picks = db.query(DraftPick).filter(DraftPick.league_id == league.id).all()
        assert len(picks) == 1
        assert str(picks[0].player_id) == result["auto_picked"]

        refreshed = db.query(League).filter(League.id == league.id).first()
        assert refreshed.draft_pick_deadline_at is not None
