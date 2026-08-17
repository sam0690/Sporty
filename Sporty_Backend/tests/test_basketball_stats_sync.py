"""Per-window NBA stat rollup — the regression net for the overwrite bug.

The bug this guards: PlayerGameweekStat is one row per (player, window) and an
NBA team plays 3-4 games inside a weekly window, so the row must be the SUM over
the window. The previous per-match path assigned one game's counts onto it, so
game 2 erased game 1.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.auth.models import RefreshToken, User  # noqa: F401
from app.league.models import Sport
from app.player.models import Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.services.sync import basketball_stats_sync
from app.services.sync.basketball_stats_sync import sync_basketball_window_stats

KNOWN_PLAYER_ID = 203507
UNKNOWN_PLAYER_ID = 999999


def _log(player_id: int, pts: int, reb: int, ast: int, stl: int, blk: int, minutes: float) -> dict:
    return {
        "PLAYER_ID": player_id,
        "PTS": pts, "REB": reb, "AST": ast, "STL": stl, "BLK": blk,
        "MIN": minutes,
    }


class _Query:
    def __init__(self, session, model):
        self.session, self.model = session, model

    def filter(self, *criteria):
        _ = criteria
        return self

    def first(self):
        if self.model is Sport:
            return self.session.sport
        if self.model is PlayerGameweekStat:
            return self.session.base_stat
        if self.model is NBAStat:
            return self.session.nba_stat
        return None

    def all(self):
        return self.session.players if self.model is Player else []


class _Session:
    """Just enough Session for the rollup: one known player, one stat row pair."""

    def __init__(self):
        self.sport = SimpleNamespace(id=uuid.uuid4(), name="basketball")
        self.players = [
            SimpleNamespace(id=uuid.uuid4(), external_api_id=f"nba:{KNOWN_PLAYER_ID}")
        ]
        self.base_stat: PlayerGameweekStat | None = None
        self.nba_stat: NBAStat | None = None
        self.commits = 0

    def query(self, model):
        return _Query(self, model)

    def add(self, obj):
        if isinstance(obj, PlayerGameweekStat):
            obj.id = uuid.uuid4()
            self.base_stat = obj
        elif isinstance(obj, NBAStat):
            self.nba_stat = obj

    def flush(self):
        pass

    def commit(self):
        self.commits += 1


def _window():
    return SimpleNamespace(
        id=uuid.uuid4(),
        start_at=datetime(2026, 11, 2, tzinfo=timezone.utc),
        end_at=datetime(2026, 11, 8, 23, 59, 59, tzinfo=timezone.utc),
    )


def _run(session, monkeypatch, rows, scored=1):
    monkeypatch.setattr(basketball_stats_sync, "_fetch_game_logs", lambda *a, **k: rows)
    monkeypatch.setattr(
        basketball_stats_sync, "score_nba_players_for_window", lambda *a, **k: scored
    )
    return asyncio.run(sync_basketball_window_stats(session, _window()))


def test_sums_multiple_games_in_one_window(monkeypatch):
    """The regression test: two games in one window must ADD, not overwrite."""
    session = _Session()
    rows = [
        _log(KNOWN_PLAYER_ID, pts=30, reb=10, ast=5, stl=2, blk=1, minutes=36.5),
        _log(KNOWN_PLAYER_ID, pts=24, reb=8, ast=7, stl=1, blk=3, minutes=33.5),
    ]

    result = _run(session, monkeypatch, rows)

    assert session.nba_stat.points == 54
    assert session.nba_stat.rebounds == 18
    assert session.nba_stat.assists == 12
    assert session.nba_stat.steals == 3
    assert session.nba_stat.blocks == 4
    assert session.base_stat.minutes_played == 70
    assert result["players"] == 1
    assert session.commits == 1


def test_minutes_are_int_and_clamped(monkeypatch):
    """minutes_played is a SmallInteger under CheckConstraint(<= 300)."""
    session = _Session()
    rows = [_log(KNOWN_PLAYER_ID, 10, 1, 1, 0, 0, minutes=120.0) for _ in range(4)]

    _run(session, monkeypatch, rows)

    assert isinstance(session.base_stat.minutes_played, int)
    assert session.base_stat.minutes_played == 300


def test_unknown_player_is_skipped_not_raised(monkeypatch):
    """Rookies and mid-season signings have no players row until a catalog rebuild."""
    session = _Session()
    rows = [
        _log(KNOWN_PLAYER_ID, 20, 5, 5, 1, 1, 30.0),
        _log(UNKNOWN_PLAYER_ID, 40, 9, 9, 2, 2, 38.0),
    ]

    result = _run(session, monkeypatch, rows)

    assert result["players"] == 1
    assert result["unknown_players"] == 1
    assert session.nba_stat.points == 20  # the unknown player's 40 is not folded in


def test_rerun_converges_rather_than_doubling(monkeypatch):
    """Assignment, not +=: the sweep is scheduled daily over the same window."""
    session = _Session()
    rows = [_log(KNOWN_PLAYER_ID, 30, 10, 5, 2, 1, 36.0)]

    _run(session, monkeypatch, rows)
    first = session.nba_stat.points
    _run(session, monkeypatch, rows)

    assert session.nba_stat.points == first == 30
    assert session.base_stat.minutes_played == 36


def test_no_game_logs_books_nothing(monkeypatch):
    """Off-season and pre-schedule windows must not create empty stat rows."""
    session = _Session()

    result = _run(session, monkeypatch, [])

    assert result == {"players": 0, "unknown_players": 0, "rows": 0, "scored": 0}
    assert session.base_stat is None
    assert session.commits == 0


def test_provider_failure_is_contained(monkeypatch):
    """stats.nba.com blocks some egress IPs — a 403 must not break the sweep."""
    session = _Session()

    def _boom(*args, **kwargs):
        raise RuntimeError("403 from stats.nba.com")

    monkeypatch.setattr(basketball_stats_sync, "_fetch_game_logs", _boom)
    result = asyncio.run(sync_basketball_window_stats(session, _window()))

    assert result["players"] == 0
    assert session.commits == 0


@pytest.mark.parametrize(
    "start_month, start_year, expected",
    [(11, 2026, "2026-27"), (1, 2027, "2026-27"), (4, 2027, "2026-27")],
)
def test_season_label_follows_the_august_rollover(start_month, start_year, expected):
    """A January window still belongs to the season that tipped off in October."""
    window = SimpleNamespace(start_at=datetime(start_year, start_month, 5, tzinfo=timezone.utc))
    assert basketball_stats_sync._season_label_for_window(window) == expected
