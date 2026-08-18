"""Checks for the two player-bio backfills' pure conversion logic.

Neither script is worth a full harness, but both decide what lands in the
database from a provider string, and both have a "fill NULLs only unless
--overwrite" rule that is easy to break. That is what this covers. No DB, no
network — the backfills' apply functions take any object with the attributes.
"""
import sys
import types
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from backfill_basketball_bio import (  # noqa: E402
    apply_entry,
    format_height,
    format_weight,
    parse_jersey,
)
from backfill_player_physicals import apply_profile  # noqa: E402


def player(**kwargs):
    """A stand-in for a Player row — the apply functions only use attributes."""
    defaults = dict(
        height=None, weight=None, date_of_birth=None, nationality=None,
        jersey_number=None,
    )
    return types.SimpleNamespace(**{**defaults, **kwargs})


@pytest.mark.parametrize("raw,expected", [
    ("6-6", "6' 6\""),
    ("6-11", "6' 11\""),
    ("", None),
    (None, None),
    ("6ft6", None),
])
def test_format_height(raw, expected):
    assert format_height(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("190", "190 lb"), ("", None), (None, None), ("190 lbs", None),
])
def test_format_weight(raw, expected):
    assert format_weight(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("8", 8), ("00", 0), ("", None), (None, None), ("N/A", None),
])
def test_parse_jersey(raw, expected):
    assert parse_jersey(raw) == expected


def test_apply_entry_fills_nulls_and_reports_fields():
    row = player()
    changed = apply_entry(row, {
        "height": "6-6", "weight": "190", "jersey_number": "8", "country": "Spain",
    })
    assert changed == {"height", "weight", "jersey_number", "nationality"}
    assert (row.height, row.weight, row.jersey_number, row.nationality) == (
        "6' 6\"", "190 lb", 8, "Spain",
    )


def test_apply_entry_leaves_existing_values_alone():
    row = player(height="7' 0\"", nationality="Curated")
    changed = apply_entry(row, {"height": "6-6", "country": "Spain"})
    assert changed == set()
    assert row.height == "7' 0\""
    assert row.nationality == "Curated"

    changed = apply_entry(row, {"height": "6-6", "country": "Spain"}, overwrite=True)
    assert changed == {"height", "nationality"}
    assert row.height == "6' 6\""


def test_apply_entry_ignores_unusable_provider_values():
    row = player()
    assert apply_entry(row, {"height": "", "weight": None, "jersey_number": "N/A"}) == set()
    assert row.height is None and row.jersey_number is None


def test_apply_profile_maps_the_api_football_block():
    row = player()
    changed = apply_profile(row, {
        "height": "183 cm", "weight": "71 kg",
        "birth": {"date": "1999-08-06", "place": "Melilla"},
        "nationality": "Spain",
    })
    assert changed == {"height", "weight", "date_of_birth", "nationality"}
    assert row.height == "183 cm"
    assert row.date_of_birth == date(1999, 8, 6)


def test_apply_profile_tolerates_a_sparse_block():
    row = player(date_of_birth=date(1990, 1, 1))
    changed = apply_profile(row, {"height": None, "birth": {}, "nationality": " "})
    assert changed == set()
    assert row.date_of_birth == date(1990, 1, 1)


def test_apply_profile_does_not_overwrite_football_data_org_values():
    row = player(nationality="England", date_of_birth=date(1990, 1, 1))
    changed = apply_profile(row, {
        "nationality": "Spain", "birth": {"date": "1991-02-02"}, "height": "183 cm",
    })
    assert changed == {"height"}
    assert row.nationality == "England"
