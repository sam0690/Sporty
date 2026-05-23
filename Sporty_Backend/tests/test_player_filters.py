from __future__ import annotations

import os
import tempfile
from types import SimpleNamespace


class _QueryStub:
    def __init__(self):
        self.filters = []
        self.offset_value = None
        self.limit_value = None
        self.order_by_args = None

    def options(self, *args, **kwargs):
        _ = args, kwargs
        return self

    def filter(self, *criteria):
        self.filters.extend(criteria)
        return self

    def count(self):
        return 37

    def order_by(self, *args):
        self.order_by_args = args
        return self

    def offset(self, value):
        self.offset_value = value
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def all(self):
        return [SimpleNamespace(id="player-1")]


class _SessionStub:
    def __init__(self):
        self.query_obj = _QueryStub()

    def query(self, model):
        _ = model
        return self.query_obj


def test_player_filter_aliases_and_pagination_apply_together():
    with tempfile.TemporaryDirectory() as temp_dir:
        previous_cwd = os.getcwd()
        os.chdir(temp_dir)
        try:
            os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
            os.environ["JWT_SECRET_KEY"] = "x" * 32
            os.environ["GOOGLE_CLIENT_ID"] = "test-client"

            import app.league.models  # noqa: F401
            import app.match.models  # noqa: F401
            import app.player.models_nba  # noqa: F401
            from app.player.models import Player
            from app.player.schemas import PlayerFilter
            from app.player.services import get_players

            filters = PlayerFilter(
                search="haaland",
                min_cost=6,
                maxCost=10,
                position="fwd",
                page=3,
                page_size=15,
            )

            assert filters.name == "haaland"
            assert filters.minCost == 6
            assert filters.maxCost == 10
            assert filters.position == "FWD"

            session = _SessionStub()
            rows, total = get_players(session, filters)

            assert total == 37
            assert rows == [SimpleNamespace(id="player-1")]
            assert session.query_obj.offset_value == 30
            assert session.query_obj.limit_value == 15
            assert any(
                "lower" in str(criterion).lower() and "like" in str(criterion).lower()
                for criterion in session.query_obj.filters
            )
            assert any(
                "players.position" in str(criterion)
                for criterion in session.query_obj.filters
            )
            assert any(
                ">=" in str(criterion) and "cost" in str(criterion)
                for criterion in session.query_obj.filters
            )
            assert any(
                "<=" in str(criterion) and "cost" in str(criterion)
                for criterion in session.query_obj.filters
            )
            assert session.query_obj.order_by_args == (Player.name,)
        finally:
            os.chdir(previous_cwd)