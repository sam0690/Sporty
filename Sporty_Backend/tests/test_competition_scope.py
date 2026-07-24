"""Competition scoping of league player pools (Phase 3).

Verifies the scope criterion/predicate confine a league's pool to its pinned
competition, that unscoped leagues see everything, and that grandfathered
players (unscoped) are unaffected. SQLite throwaway DB, same bootstrap as
test_draft_room_live.py.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException

_temp_dir = tempfile.mkdtemp(prefix="sporty-comp-scope-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'scope.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
import app.auth.models  # noqa: F401,E402
import app.match.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
from app.league.competition_scope import (  # noqa: E402
    competition_scope_criterion,
    ensure_player_in_league_scope,
    filter_pool_by_scope,
    player_in_league_scope,
    scoped_team_ids_by_sport_name,
)
from app.auth.models import AuthProvider, User  # noqa: E402
from app.league import services as league_service  # noqa: E402
from app.league.models import LeagueSport, Season, Sport  # noqa: E402
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


def _fixture(db, *, filter_comp: str | None):
    """Football sport, an EPL club + a La Liga club with a player each, and a
    league whose football pool is scoped to `filter_comp`."""
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()

    epl_team = RealTeam(sport_id=sport.id, name="Arsenal",
                        external_api_id="42", competition="EPL")
    laliga_team = RealTeam(sport_id=sport.id, name="Barcelona",
                           external_api_id="529", competition="LALIGA")
    legacy_team = RealTeam(sport_id=sport.id, name="Old Club",
                           external_api_id="football:old", competition=None)
    db.add_all([epl_team, laliga_team, legacy_team])
    db.flush()

    def mk(team, nm):
        p = Player(sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:8]}",
                   name=nm, position="MID", real_team=team.name,
                   real_team_id=team.id, cost=Decimal("5"), is_available=True)
        db.add(p)
        db.flush()
        return p

    epl_p, laliga_p, legacy_p = mk(epl_team, "Saka"), mk(laliga_team, "Pedri"), mk(legacy_team, "Ghost")

    owner = User(username=f"o-{uuid.uuid4().hex[:6]}", email=f"{uuid.uuid4().hex[:6]}@ex.com",
                 auth_provider=AuthProvider.LOCAL, password_hash="hashed")
    db.add(owner)
    season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
                    start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    db.add(season)
    db.flush()

    payload = LeagueCreate(name=f"L-{uuid.uuid4().hex[:8]}", season_id=season.id,
                           squad_size=15, sports=["football"],
                           competition_filters={"football": filter_comp} if filter_comp else {})
    league = league_service.create_league(db, payload, owner)
    db.flush()
    return league, sport, epl_p, laliga_p, legacy_p


def _query_ids(db, league_id):
    q = db.query(Player)
    crit = competition_scope_criterion(db, league_id)
    if crit is not None:
        q = q.filter(crit)
    return {p.id for p in q.all()}


def test_scoped_league_excludes_other_competition():
    with session_scope() as db:
        league, _, epl_p, laliga_p, legacy_p = _fixture(db, filter_comp="EPL")
        ids = _query_ids(db, league.id)
        assert epl_p.id in ids
        assert laliga_p.id not in ids       # other competition excluded
        assert legacy_p.id not in ids       # untagged club excluded when scoped


def test_unscoped_league_sees_all():
    with session_scope() as db:
        league, _, epl_p, laliga_p, legacy_p = _fixture(db, filter_comp=None)
        assert competition_scope_criterion(db, league.id) is None
        ids = _query_ids(db, league.id)
        assert {epl_p.id, laliga_p.id, legacy_p.id} <= ids


def test_predicate_and_ensure():
    with session_scope() as db:
        league, _, epl_p, laliga_p, _ = _fixture(db, filter_comp="EPL")
        assert player_in_league_scope(db, league.id, epl_p) is True
        assert player_in_league_scope(db, league.id, laliga_p) is False
        ensure_player_in_league_scope(db, league.id, epl_p)  # no raise
        with pytest.raises(HTTPException) as exc:
            ensure_player_in_league_scope(db, league.id, laliga_p)
        assert exc.value.status_code == 409


def test_filter_pool_by_scope_on_materialized_pool():
    with session_scope() as db:
        league, _, epl_p, laliga_p, _ = _fixture(db, filter_comp="EPL")
        scoped = scoped_team_ids_by_sport_name(db, league.id)

        class _Row:
            def __init__(self, p):
                self.sport_type = "football"
                self.real_team_id = str(p.real_team_id)

        pool = [_Row(epl_p), _Row(laliga_p)]
        kept = filter_pool_by_scope(pool, scoped)
        assert len(kept) == 1
        assert kept[0].real_team_id == str(epl_p.real_team_id)
