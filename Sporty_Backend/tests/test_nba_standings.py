"""NBA standings, derived from our own match rows.

The table is a pure function of finished games, so these pin the arithmetic
that has no second source to check it against: games-behind, win percentage,
streaks, and the guarantee that every game contributes exactly one win and one
loss.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.auth.models import RefreshToken, User  # noqa: F401
from app.competition import nba_competition as nc
from app.league.models import Sport
from app.match.models import Match
from app.player.models import RealTeam

SEASON = 2026
LABEL = "2026-27"

# Two per division so conference/division grouping is exercised with real splits.
TEAMS = [
    ("BOS", "Boston", "East", "Atlantic"),
    ("NYK", "New York", "East", "Atlantic"),
    ("CLE", "Cleveland", "East", "Central"),
    ("DET", "Detroit", "East", "Central"),
    ("LAL", "Los Angeles", "West", "Pacific"),
    ("GSW", "Golden State", "West", "Pacific"),
]


class _Query:
    def __init__(self, session, model):
        self.session, self.model = session, model

    def filter(self, *criteria):
        _ = criteria
        return self

    def order_by(self, *args):
        return self

    def first(self):
        return self.session.sport if self.model is Sport else None

    def all(self):
        if self.model is RealTeam:
            return self.session.teams
        if self.model is Match:
            return self.session.matches
        return []


class _Session:
    def __init__(self, matches=None):
        self.sport = SimpleNamespace(id=uuid.uuid4(), name="basketball")
        self.teams = [
            SimpleNamespace(
                id=uuid.uuid4(), name=tla, abbreviation=tla, city=city,
                conference=conf, division=div, logo_url=None,
            )
            for tla, city, conf, div in TEAMS
        ]
        self.matches = matches or []

    def query(self, model):
        return _Query(self, model)


def _match(home, away, home_score, away_score, day=0, status="finished"):
    return SimpleNamespace(
        external_api_id=f"bdl:{home}{away}{day}",
        home_team=home,
        away_team=away,
        home_score=home_score,
        away_score=away_score,
        status=status,
        match_date=datetime(2026, 10, 20, tzinfo=timezone.utc) + timedelta(days=day),
        season=LABEL,
    )


def _row(payload, group, tla):
    table = next(g["table"] for g in payload["standings"] if g["group"] == group)
    return next(r for r in table if r["team"]["tla"] == tla)


def test_every_game_books_one_win_and_one_loss():
    session = _Session([
        _match("BOS", "NYK", 110, 100, day=0),
        _match("CLE", "DET", 99, 105, day=1),
        _match("LAL", "GSW", 120, 118, day=2),
    ])

    payload = nc.build_standings(session, SEASON)
    league = next(g for g in payload["standings"] if g["type"] == "TOTAL")["table"]

    assert sum(r["won"] for r in league) == 3
    assert sum(r["lost"] for r in league) == 3
    assert payload["season"]["gamesPlayed"] == 3


def test_win_pct_and_ordering():
    session = _Session([
        _match("BOS", "NYK", 110, 100, day=0),
        _match("BOS", "CLE", 110, 100, day=1),
        _match("BOS", "DET", 90, 100, day=2),
    ])

    payload = nc.build_standings(session, SEASON)
    bos = _row(payload, "League", "BOS")

    assert (bos["won"], bos["lost"]) == (2, 1)
    assert bos["winPct"] == pytest.approx(0.667, abs=0.001)

    league = next(g for g in payload["standings"] if g["type"] == "TOTAL")["table"]
    assert [r["winPct"] for r in league] == sorted(
        (r["winPct"] for r in league), reverse=True
    )
    assert [r["position"] for r in league] == list(range(1, len(league) + 1))


def test_games_behind_is_zero_for_the_leader_and_half_a_game_per_swing():
    # BOS 2-0, NYK 1-1 -> ((2-1) + (1-0)) / 2 = 1.0
    session = _Session([
        _match("BOS", "CLE", 110, 100, day=0),
        _match("BOS", "DET", 110, 100, day=1),
        _match("NYK", "CLE", 110, 100, day=2),
        _match("NYK", "DET", 100, 110, day=3),
    ])

    payload = nc.build_standings(session, SEASON)

    assert _row(payload, "League", "BOS")["gamesBehind"] == 0.0
    assert _row(payload, "League", "NYK")["gamesBehind"] == 1.0
    # Every group re-bases games-behind on its own leader.
    for group in payload["standings"]:
        assert group["table"][0]["gamesBehind"] == 0.0


def test_streak_counts_the_tail_not_the_total():
    session = _Session([
        _match("BOS", "CLE", 110, 100, day=0),  # W
        _match("BOS", "DET", 90, 100, day=1),   # L
        _match("BOS", "NYK", 110, 100, day=2),  # W
        _match("BOS", "LAL", 110, 100, day=3),  # W
    ])

    bos = _row(nc.build_standings(session, SEASON), "League", "BOS")

    assert bos["streak"] == "W2"
    assert bos["form"] == "W,L,W,W"


def test_groups_cover_league_conferences_and_divisions():
    payload = nc.build_standings(_Session(), SEASON)
    groups = {(g["type"], g["group"]): len(g["table"]) for g in payload["standings"]}

    assert groups[("TOTAL", "League")] == 6
    assert groups[("CONFERENCE", "East")] == 4
    assert groups[("CONFERENCE", "West")] == 2
    assert groups[("DIVISION", "Atlantic")] == 2
    # Conferences appear East-then-West, not alphabetically by accident.
    conferences = [g["group"] for g in payload["standings"] if g["type"] == "CONFERENCE"]
    assert conferences == ["East", "West"]


def test_unplayed_games_are_ignored():
    session = _Session([
        _match("BOS", "NYK", 110, 100, day=0),
        _match("CLE", "DET", None, None, day=1, status="scheduled"),
        _match("LAL", "GSW", 60, 55, day=2, status="live"),
    ])

    payload = nc.build_standings(session, SEASON)

    assert payload["season"]["gamesPlayed"] == 1
    assert _row(payload, "League", "LAL")["playedGames"] == 0


def test_pre_season_table_is_every_team_at_zero():
    payload = nc.build_standings(_Session(), SEASON)
    league = next(g for g in payload["standings"] if g["type"] == "TOTAL")["table"]

    assert len(league) == 6
    assert all(r["playedGames"] == 0 and r["winPct"] == 0.0 for r in league)
    assert all(r["streak"] is None for r in league)


def test_tie_scores_are_discarded_as_bad_data():
    """NBA games cannot end level, so a 'finished' draw is corrupt input."""
    session = _Session([_match("BOS", "NYK", 100, 100, day=0)])

    payload = nc.build_standings(session, SEASON)

    assert payload["season"]["gamesPlayed"] == 0
    assert _row(payload, "League", "BOS")["playedGames"] == 0


def test_unknown_team_in_a_fixture_does_not_break_the_table():
    session = _Session([
        _match("BOS", "NYK", 110, 100, day=0),
        _match("BOS", "PHX", 110, 100, day=1),  # PHX has no roster row here
    ])

    payload = nc.build_standings(session, SEASON)

    assert _row(payload, "League", "BOS")["won"] == 1  # only the valid game
    assert payload["season"]["gamesPlayed"] == 1


def test_matches_payload_maps_status_and_winner():
    session = _Session([
        _match("BOS", "NYK", 110, 100, day=0),
        _match("CLE", "DET", None, None, day=1, status="scheduled"),
        _match("LAL", "GSW", 60, 55, day=2, status="live"),
    ])

    payload = nc.build_matches(session, SEASON)
    by_id = {m["id"]: m for m in payload["matches"]}

    assert by_id["bdl:BOSNYK0"]["status"] == "FINISHED"
    assert by_id["bdl:BOSNYK0"]["score"]["winner"] == "HOME_TEAM"
    assert by_id["bdl:CLEDET1"]["status"] == "SCHEDULED"
    assert by_id["bdl:CLEDET1"]["score"]["winner"] is None
    assert by_id["bdl:LALGSW2"]["status"] == "IN_PLAY"
    # The NBA has no matchweeks — the page groups these by date instead.
    assert all(m["matchday"] is None for m in payload["matches"])


def test_season_helpers_are_shared_with_the_fixture_sync():
    """Standings read the rows the fixture sync writes.

    If the two ever computed "the current season" differently, the table would
    be built for a season we hold no games for and silently render all-zeros —
    which is exactly what happened when this module had its own copy.
    """
    from app.services.sync import basketball_sync

    assert nc.current_nba_season is basketball_sync.current_nba_season
    assert nc.season_label is basketball_sync.season_label


def test_season_label_formats_as_two_year_span():
    assert nc.season_label(2026) == "2026-27"
    assert nc.season_label(2029) == "2029-30"
    assert nc.season_label(1999) == "1999-00"


def test_display_name_resolves_abbreviations_to_full_names():
    """RealTeam.name holds the abbreviation for basketball, so the table would
    otherwise read "ATL" (or "Atlanta ATL" if concatenated with the city)."""
    team = SimpleNamespace(abbreviation="ATL", name="ATL")
    assert nc.display_name(team) == "Atlanta Hawks"

    # Unknown abbreviation degrades to what we stored rather than blanking.
    assert nc.display_name(SimpleNamespace(abbreviation="ZZZ", name="ZZZ")) == "ZZZ"


def test_every_team_in_a_built_table_gets_a_full_name():
    payload = nc.build_standings(_Session(), SEASON)
    league = next(g for g in payload["standings"] if g["type"] == "TOTAL")["table"]

    for row in league:
        assert row["team"]["name"] in nc.NBA_TEAM_NAMES.values()
        assert row["team"]["name"] != row["team"]["tla"]
