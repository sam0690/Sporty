"""Admin scoring-rule CRUD (phase 5) — the config-without-deploy path."""
import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-scoring-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'x.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"
_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User, UserRole  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
import app.notification.models  # noqa: F401,E402
import app.admin.models  # noqa: F401,E402
from app.league.models import Sport  # noqa: E402
from app.scoring.models import DefaultScoringRule  # noqa: E402
from app.admin import services  # noqa: E402
from app.admin.schemas import ScoringRuleCreate, ScoringRuleUpdate  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=ENGINE)


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _admin(db):
    u = User(username="admin", email="a@x.com", auth_provider=AuthProvider.LOCAL,
             password_hash="x", role=UserRole.ADMIN)
    db.add(u)
    db.flush()
    return u


def test_scoring_rule_crud_and_conflict():
    with session_scope() as db:
        admin = _admin(db)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.commit()

        created = services.create_scoring_rule(db, admin, ScoringRuleCreate(
            sport_id=sport.id, action="goal", position="MID", mode="per_unit",
            param=None, points=5, description="MID goal"))
        assert created.points == Decimal("5")

        # list
        rules = services.list_scoring_rules(db, sport.id)
        assert len(rules) == 1

        # update the value (config without deploy)
        updated = services.update_scoring_rule(db, admin, created.id,
                                               ScoringRuleUpdate(points=7))
        assert updated.points == Decimal("7")

        # duplicate (sport, action, position) rejected
        with pytest.raises(HTTPException) as ei:
            services.create_scoring_rule(db, admin, ScoringRuleCreate(
                sport_id=sport.id, action="goal", position="MID", mode="per_unit",
                param=None, points=9, description="dupe"))
        assert ei.value.status_code == 409

        # bad mode rejected
        with pytest.raises(HTTPException):
            services.create_scoring_rule(db, admin, ScoringRuleCreate(
                sport_id=sport.id, action="x", position=None, mode="bogus",
                param=None, points=1, description="bad"))

        # delete
        services.delete_scoring_rule(db, admin, created.id)
        assert services.list_scoring_rules(db, sport.id) == []
