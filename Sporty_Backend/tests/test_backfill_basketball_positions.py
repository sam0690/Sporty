"""scripts/backfill_basketball_positions.py's resolve_position() — maps the
coarse G/F/C (and hyphenated combo) codes nba_api's CommonTeamRoster returns
to the app's PG/SG/SF/PF/C codes, and leaves players with no current-roster
match alone (not guessed at)."""
from __future__ import annotations

import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parents[1]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))
scripts_dir = _backend_root / "scripts"
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from backfill_basketball_positions import POSITION_MAP, resolve_position


def test_maps_every_observed_nba_api_coarse_code() -> None:
    # The full set seen live from CommonTeamRoster across several teams (2026-07-18).
    observed = {"G", "F", "C", "G-F", "F-G", "F-C", "C-F"}
    assert observed <= POSITION_MAP.keys()
    assert set(POSITION_MAP.values()) <= {"PG", "SG", "SF", "PF", "C"}


def test_resolve_position_maps_known_roster_entry() -> None:
    nba_positions = {"203991": "C"}
    assert resolve_position("nba:203991", nba_positions) == "C"


def test_resolve_position_none_when_not_on_current_roster() -> None:
    assert resolve_position("nba:999999", {"203991": "C"}) is None


def test_resolve_position_none_for_unmapped_code() -> None:
    assert resolve_position("nba:1", {"1": "Two-Way"}) is None
