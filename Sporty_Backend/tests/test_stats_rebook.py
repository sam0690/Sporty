"""Re-booking a finished match rescues players the sheet couldn't resolve.

The real case this exists for: in La Liga fixture 1570333 the provider reported
Aitor Mañas as 330440 on the stat sheet but 623902 everywhere else, and Mikel
Rodríguez as 389022 vs 332645. Both played, one scored, and both booked nothing
— the club-scoped name fallback that rescues them shipped three hours after the
match was booked, and nothing ever re-parsed the sheet.
"""

from types import SimpleNamespace

from app.services.sync.football_live_sync import (
    _fixture_data_from_sheet,
    _parse_player_sheet,
)


def _entry(api_id: int, name: str, minutes: int, goals: int = 0):
    return {
        "player": {"id": api_id, "name": name},
        "statistics": [
            {
                "games": {"minutes": minutes, "position": "M"},
                "goals": {"total": goals, "assists": 0, "saves": 0, "conceded": 0},
                "cards": {"yellow": 0, "red": 0},
            }
        ],
    }


SHEET = {
    "response": [
        {
            "team": {"id": 542, "name": "Alaves"},
            "players": [
                _entry(623902, "A. Manas", 57),          # resolves by id
                _entry(389022, "Mikel Rodriguez", 33, goals=1),  # id drift
            ],
        },
        {
            "team": {"id": 546, "name": "Getafe"},
            "players": [_entry(24882, "Orel Mangala", 90)],  # not in our pool
        },
    ]
}

MATCH = SimpleNamespace(
    home_team="Alaves", away_team="Getafe", home_score=3, away_score=0,
)


class _Player:
    def __init__(self, pid, name):
        self.id = pid
        self.name = name


def test_fixture_data_is_rebuilt_from_the_sheet_and_our_score():
    """A long-finished match has no live fixture payload left, so the bits
    _parse_player_sheet needs — team ids and the final score — come from the
    sheet plus our own match row."""
    data = _fixture_data_from_sheet(SHEET, MATCH)
    assert data["teams"]["home"]["id"] == 542
    assert data["teams"]["away"]["id"] == 546
    assert data["goals"] == {"home": 3, "away": 0}


def test_sides_are_matched_by_name_not_response_order():
    flipped = {"response": list(reversed(SHEET["response"]))}
    data = _fixture_data_from_sheet(flipped, MATCH)
    assert data["teams"]["home"]["id"] == 542  # Alaves is still home


def test_id_drift_is_rescued_by_the_club_scoped_name_fallback(monkeypatch):
    """The whole point of re-booking: 389022 is unknown to us, but the club's
    roster has 'Mikel Rodríguez', and that is who played."""
    manas = _Player("uuid-manas", "A. Manas")
    mikel = _Player("uuid-mikel", "Mikel Rodríguez")

    by_id = {"623902": manas}  # 389022 deliberately absent

    class _Index:
        def match(self, name, club=None):
            return mikel if "rodriguez" in name.lower() else None

    monkeypatch.setattr(
        "app.services.sync.football_live_sync._club_name_index",
        lambda db, sport_id, team_name: _Index(),
    )
    booked = _parse_player_sheet(
        SHEET,
        _fixture_data_from_sheet(SHEET, MATCH),
        lambda api_id: by_id.get(str(api_id)),
        db=object(),
        sport_id="sport-1",
    )

    assert booked["uuid-manas"]["minutes"] == 57
    # Rescued despite the sheet's id being unknown to us.
    assert booked["uuid-mikel"]["minutes"] == 33
    assert booked["uuid-mikel"]["goals"] == 1
    # Genuinely not in our pool — stays out, and can't be scored or picked.
    assert len(booked) == 2


def test_rebooking_the_same_sheet_twice_converges():
    """persist_football_stats_from_sheet assigns rather than accumulates, so a
    re-book must produce identical numbers, not doubled ones."""
    args = (SHEET, _fixture_data_from_sheet(SHEET, MATCH), lambda api_id: None)
    first = _parse_player_sheet(*args)
    second = _parse_player_sheet(*args)
    assert first == second
