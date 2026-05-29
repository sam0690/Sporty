from __future__ import annotations

import os
import tempfile
import uuid
from types import SimpleNamespace
from pathlib import Path
import sys


class _QueryStub:
    def __init__(self):
        self.joins = []
        self.options_args = []
        self.filters = []
        self.rows = [SimpleNamespace(id="stat-1")]

    def join(self, target):
        self.joins.append(target)
        return self

    def options(self, *args, **kwargs):
        _ = kwargs
        self.options_args.extend(args)
        return self

    def filter(self, *criteria):
        self.filters.extend(criteria)
        return self

    def all(self):
        return self.rows


class _SessionStub:
    def __init__(self):
        self.query_obj = _QueryStub()
        self.model = None

    def query(self, model):
        self.model = model
        return self.query_obj


def test_bulk_player_stats_query_returns_all_rows_for_sport_and_gameweek():
    with tempfile.TemporaryDirectory() as temp_dir:
        previous_cwd = os.getcwd()
        os.chdir(temp_dir)
        try:
            repo_root = Path(__file__).resolve().parents[1]
            sys.path.insert(0, str(repo_root))
            os.environ.setdefault(
                "DATABASE_URL",
                "postgresql+psycopg2://user:pass@localhost/test",
            )
            os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
            os.environ.setdefault("JWT_SECRET_KEY", "x" * 32)
            os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client")

            import app.auth.models  # noqa: F401
            import app.league.models  # noqa: F401
            import app.match.models  # noqa: F401
            import app.player.models_nba  # noqa: F401
            from app.player.models import PlayerGameweekStat
            from app.player.services import get_player_stats_for_gameweek

            session = _SessionStub()
            gameweek_id = uuid.uuid4()

            rows = get_player_stats_for_gameweek(
                session,
                gameweek_id,
                " Basketball ",
            )

            assert session.model is PlayerGameweekStat
            assert rows == [SimpleNamespace(id="stat-1")]
            assert len(session.query_obj.joins) == 2
            assert session.query_obj.filters
        finally:
            os.chdir(previous_cwd)