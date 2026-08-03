"""BallDontLie game -> Match column mapping.

Wrong team form would create fixtures that don't join to basketball RealTeam
rows (whose `name` is the abbreviation), and a dropped tip-off time would put
every game at 00:00 UTC, moving lineup deadlines.
"""

import uuid
from datetime import datetime, timezone

from app.services.sync.basketball_sync import (
    current_nba_season,
    match_fields,
    season_label,
)

SPORT_ID = uuid.uuid4()


def _game(**overrides):
    game = {
        "id": 18446819,
        "date": "2026-10-20",
        "datetime": "2026-10-21T23:30:00.000Z",
        "season": 2026,
        "status": "",
        "period": 0,
        "postseason": False,
        "home_team_score": 0,
        "visitor_team_score": 0,
        "home_team": {"abbreviation": "OKC", "full_name": "Oklahoma City Thunder"},
        "visitor_team": {"abbreviation": "HOU", "full_name": "Houston Rockets"},
    }
    game.update(overrides)
    return game


def test_scheduled_game_maps_to_match_columns():
    fields = match_fields(_game(), SPORT_ID, 2026)

    assert fields["sport_id"] == SPORT_ID
    assert fields["external_api_id"] == "bdl:18446819"
    # Abbreviations, not full names — RealTeam.name for basketball is "OKC".
    assert (fields["home_team"], fields["away_team"]) == ("OKC", "HOU")
    assert fields["competition"] == "NBA"
    assert fields["season"] == "2026-27"
    assert fields["status"] == "scheduled"
    # Tip-off, not the US-local calendar date.
    assert fields["match_date"] == datetime(2026, 10, 21, 23, 30, tzinfo=timezone.utc)
    # No 0-0 scoreline on a game that hasn't been played.
    assert fields["home_score"] is None and fields["away_score"] is None


def test_finished_and_live_games_keep_scores():
    final = match_fields(
        _game(status="Final", period=4, home_team_score=125, visitor_team_score=124),
        SPORT_ID,
        2026,
    )
    assert final["status"] == "finished"
    assert (final["home_score"], final["away_score"]) == (125, 124)

    live = match_fields(
        _game(status="3rd Qtr", period=3, home_team_score=70, visitor_team_score=68),
        SPORT_ID,
        2026,
    )
    assert live["status"] == "live"
    assert (live["home_score"], live["away_score"]) == (70, 68)


def test_missing_datetime_falls_back_to_calendar_date():
    fields = match_fields(_game(datetime=None), SPORT_ID, 2026)
    assert fields["match_date"] == datetime(2026, 10, 20, tzinfo=timezone.utc)


def test_incomplete_game_is_rejected():
    assert match_fields(_game(home_team={}), SPORT_ID, 2026) is None
    assert match_fields(_game(id=None), SPORT_ID, 2026) is None


def test_season_helpers():
    assert season_label(2026) == "2026-27"
    assert season_label(2099) == "2099-00"
    # August (schedule drop) onward belongs to the season starting that year.
    assert current_nba_season() in (2025, 2026, 2027)
