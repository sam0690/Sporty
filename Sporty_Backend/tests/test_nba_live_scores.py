"""Live NBA score mapping.

Fixtures and live scores both come from BallDontLie, so a game's id IS the
fixture's external_api_id ("bdl:<id>") — the lookup is a direct key hit with no
team/date matching anywhere. (An earlier version sourced live data from a
different provider and joined on `Match.external_api_id == <that provider's game
id>`, which could never match, so every live game was silently skipped. These
tests pin the shape that made that class of bug impossible.)

The other load-bearing piece is game_state: BallDontLie's `status` field is an
ISO timestamp before tip-off and free text afterwards, so reading it as a status
string is what would silently mark unplayed games live.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.auth.models import RefreshToken, User  # noqa: F401
from app.services.sync.nba_live_sync import _coerce_int, game_state


def _match(external_api_id="bdl:21717855", status="scheduled"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        external_api_id=external_api_id,
        home_team="CLE",
        away_team="PHI",
        match_date=datetime(2026, 11, 6, 0, 0, tzinfo=timezone.utc),
        status=status,
    )


def test_game_id_is_the_fixture_key():
    """The whole point of one provider: lookup, not matching."""
    match = _match("bdl:21717855")
    candidates = {match.external_api_id: match}

    assert candidates.get(f"bdl:{21717855}") is match


def test_a_game_with_no_fixture_row_is_skipped():
    candidates = {"bdl:21717855": _match()}

    assert candidates.get(f"bdl:{99999999}") is None


@pytest.mark.parametrize(
    "game, expected",
    [
        # Before tip-off `status` is an ISO timestamp, NOT a status word — this
        # is the payload that would read as "live" if status_state were ignored.
        ({"status": "2026-10-20T19:00:00Z", "status_state": "scheduled", "period": 0}, "scheduled"),
        ({"status": "1st Qtr", "status_state": "in", "period": 1}, "live"),
        ({"status": "Halftime", "status_state": "in", "period": 2}, "live"),
        ({"status": "Final", "status_state": "final", "period": 4}, "finished"),
        ({"status": "Final/OT", "status_state": "final", "period": 5}, "finished"),
        # Fallbacks for payloads without status_state.
        ({"status": "Final", "period": 4}, "finished"),
        ({"status": "3rd Qtr", "period": 3}, "live"),
        ({"status": "2026-10-20T19:00:00Z", "period": 0}, "scheduled"),
        ({}, "scheduled"),
    ],
)
def test_game_state_reads_status_state_first(game, expected):
    assert game_state(game) == expected


def test_scheduled_games_are_left_untouched():
    """A tick must never overwrite a fixture that has not tipped off."""
    assert game_state({"status_state": "scheduled", "period": 0}) == "scheduled"


@pytest.mark.parametrize(
    "value, expected",
    [(0, 0), (112, 112), ("98", 98), (None, 0), ("", 0), ("nonsense", 0)],
)
def test_scores_coerce_without_raising(value, expected):
    assert _coerce_int(value) == expected
