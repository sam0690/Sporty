"""Owned-player exclusion is a DRAFT rule, not a budget one.

Budget leagues are FPL-style: two managers may both own Haaland. The market
listed the pool with the draft exclusion applied to every league, so a rival's
signing vanished from the team builder and the transfer market.
"""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "x" * 32)
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client")

# Reading League.draft_mode configures ALL mappers, and the League/Sport
# relationships name classes spread across a dozen modules — app.main is the
# one place that already imports every model module, so borrow it.
import app.main  # noqa: E402,F401


class _ScalarQuery:
    """Serves the one `db.query(League.draft_mode)...scalar()` lookup."""

    def __init__(self, value):
        self.value = value

    def filter(self, *criteria):
        _ = criteria
        return self

    def scalar(self):
        return self.value


class _RowQuery:
    def options(self, *args, **kwargs):
        _ = args, kwargs
        return self

    def filter(self, *criteria):
        _ = criteria
        return self

    def count(self):
        return 0

    def order_by(self, *args):
        _ = args
        return self

    def offset(self, value):
        _ = value
        return self

    def limit(self, value):
        _ = value
        return self

    def all(self):
        return []


class _Session:
    def __init__(self, draft_mode: bool):
        self.draft_mode = draft_mode

    def query(self, *entities):
        if any("draft_mode" in str(entity) for entity in entities):
            return _ScalarQuery(self.draft_mode)
        return _RowQuery()


def _excluded_owned(draft_mode: bool) -> bool:
    """Run get_players for a league and report whether the owned-player
    exclusion was applied."""
    from app.player import services
    from app.player.schemas import PlayerFilter

    calls: list[uuid.UUID] = []
    original = services._exclude_owned_players
    services._exclude_owned_players = lambda query, league_id: (
        calls.append(league_id) or query
    )
    # The league pool join needs a real DB; the branch under test doesn't.
    original_pool = services._apply_league_player_pool
    services._apply_league_player_pool = lambda query, db, league_id: query
    try:
        services.get_players(
            _Session(draft_mode),
            PlayerFilter(league_id=uuid.uuid4(), search="haaland"),
        )
    finally:
        services._exclude_owned_players = original
        services._apply_league_player_pool = original_pool
    return bool(calls)


def test_budget_league_shows_players_already_owned_by_a_rival():
    assert _excluded_owned(draft_mode=False) is False


def test_draft_league_still_hides_drafted_players():
    assert _excluded_owned(draft_mode=True) is True


def test_no_league_id_never_excludes():
    from app.player import services
    from app.player.schemas import PlayerFilter

    calls: list[uuid.UUID] = []
    original = services._exclude_owned_players
    services._exclude_owned_players = lambda query, league_id: (
        calls.append(league_id) or query
    )
    try:
        services.get_players(_Session(True), PlayerFilter(search="haaland"))
    finally:
        services._exclude_owned_players = original
    assert calls == []

