"""Checks for the API-Football quota guard and prediction parsing."""

import pytest

from app.core.config import settings
from app.external_apis.football_api import FootballQuotaExhausted, _spend_quota


class FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key, ttl):
        pass


def test_spend_quota_raises_once_budget_spent(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.core.redis.get_redis", lambda: fake)
    monkeypatch.setattr(settings, "FOOTBALL_API_DAILY_BUDGET", 3)

    for _ in range(3):
        _spend_quota()
    with pytest.raises(FootballQuotaExhausted):
        _spend_quota()
    with pytest.raises(FootballQuotaExhausted):
        _spend_quota()


def test_spend_quota_zero_budget_means_unlimited(monkeypatch):
    monkeypatch.setattr(
        "app.core.redis.get_redis",
        lambda: (_ for _ in ()).throw(AssertionError("must not touch redis")),
    )
    monkeypatch.setattr(settings, "FOOTBALL_API_DAILY_BUDGET", 0)
    _spend_quota()  # no redis call, no raise


def test_spend_quota_fails_open_when_redis_down(monkeypatch):
    def _boom():
        raise ConnectionError("redis down")

    monkeypatch.setattr("app.core.redis.get_redis", _boom)
    monkeypatch.setattr(settings, "FOOTBALL_API_DAILY_BUDGET", 1)
    _spend_quota()  # provider's own hard cap is the backstop
    _spend_quota()


def test_parse_prediction_normalizes_percents():
    from app.services.sync.football_live_sync import _parse_prediction

    payload = {
        "response": [
            {"predictions": {"percent": {"home": "45%", "draw": "25%", "away": "30%"}}}
        ]
    }
    pred = _parse_prediction(payload)
    assert pred is not None
    assert pred["model_version"] == "api-football-v3"
    total = pred["home_win_prob"] + pred["draw_prob"] + pred["away_win_prob"]
    assert total == pytest.approx(1.0, abs=1e-3)
    assert pred["home_win_prob"] == pytest.approx(0.45, abs=1e-3)


class _FakePlayer:
    def __init__(self, uuid_):
        self.id = uuid_


def test_parse_player_sheet_maps_and_derives_clean_sheet():
    from app.services.sync.football_live_sync import _parse_player_sheet

    known = {101: _FakePlayer("uuid-keeper"), 202: _FakePlayer("uuid-striker")}
    fixture_data = {
        "teams": {"home": {"id": 1}, "away": {"id": 2}},
        "goals": {"home": 2, "away": 0},  # home kept a clean sheet
    }
    payload = {
        "response": [
            {
                "team": {"id": 1},
                "players": [
                    {
                        "player": {"id": 101},
                        "statistics": [{
                            "games": {"minutes": 90},
                            "goals": {"total": None, "conceded": 0, "assists": None, "saves": 4},
                            "cards": {"yellow": 1, "red": 0},
                            "penalty": {"saved": 1, "missed": None},
                        }],
                    },
                    {"player": {"id": 999}, "statistics": [{}]},  # unlinked — skipped
                ],
            },
            {
                "team": {"id": 2},
                "players": [
                    {
                        "player": {"id": 202},
                        "statistics": [{
                            "games": {"minutes": 78},
                            "goals": {"total": 0, "conceded": 2, "assists": 1, "saves": None},
                            "cards": {"yellow": 0, "red": 0},
                            "penalty": {},
                        }],
                    },
                ],
            },
        ]
    }

    sheet = _parse_player_sheet(payload, fixture_data, lambda api_id: known.get(api_id))
    assert set(sheet) == {"uuid-keeper", "uuid-striker"}

    keeper = sheet["uuid-keeper"]
    assert keeper["minutes"] == 90
    assert keeper["saves"] == 4
    assert keeper["penalties_saved"] == 1
    assert keeper["yellow_cards"] == 1
    assert keeper["clean_sheets"] == 1  # team conceded 0, played >= 60

    striker = sheet["uuid-striker"]
    assert striker["assists"] == 1
    assert striker["goals_conceded"] == 2
    assert striker["clean_sheets"] == 0  # team conceded


def test_parse_player_sheet_empty_payload():
    from app.services.sync.football_live_sync import _parse_player_sheet

    assert _parse_player_sheet({}, {}, lambda _: None) == {}


def test_parse_prediction_rejects_empty_and_malformed():
    from app.services.sync.football_live_sync import _parse_prediction

    assert _parse_prediction({}) is None
    assert _parse_prediction({"response": []}) is None
    assert _parse_prediction(
        {"response": [{"predictions": {"percent": {"home": "n/a", "draw": "", "away": ""}}}]}
    ) is None


# ── FT sheet: provider player-id drift ───────────────────────────────────────
# API-Football reports some people under two ids — Mikel Rodríguez is 332645 in
# /fixtures/events and /players/squads but 389022 on the stat sheet. The sheet
# parser used to skip unresolvable ids silently, which cost him a goal in La
# Liga fixture 1570333. Resolution now falls back to name matching scoped to
# the player's own club.


class _NamedPlayer:
    def __init__(self, uuid_, name):
        self.id = uuid_
        self.name = name


class _FakePool:
    """Stands in for db.query(Player).filter(...).all()."""

    def __init__(self, by_club):
        self._by_club = by_club
        self._club = None

    def query(self, _model):
        return self

    def filter(self, *criteria):
        # The club predicate is Player.real_team == <name>; pull the literal out.
        for crit in criteria:
            right = getattr(crit, "right", None)
            value = getattr(right, "value", None)
            if isinstance(value, str):
                self._club = value
        return self

    def all(self):
        return self._by_club.get(self._club, [])


def _sheet_payload(team_name, api_id, player_name):
    return {
        "response": [
            {
                "team": {"id": 1, "name": team_name},
                "players": [
                    {
                        "player": {"id": api_id, "name": player_name},
                        "statistics": [{
                            "games": {"minutes": 33},
                            "goals": {"total": 1, "conceded": 0},
                        }],
                    }
                ],
            }
        ]
    }


_FIXTURE = {"teams": {"home": {"id": 1}, "away": {"id": 2}}, "goals": {"home": 3, "away": 0}}


def test_sheet_falls_back_to_name_match_within_the_same_club():
    from app.services.sync.football_live_sync import _parse_player_sheet

    ours = _NamedPlayer("uuid-mikel", "Mikel Rodríguez")
    db = _FakePool({"Alaves": [ours]})

    sheet = _parse_player_sheet(
        _sheet_payload("Alaves", 389022, "Mikel Rodriguez"),
        _FIXTURE,
        lambda api_id: None,  # id 389022 is unknown to us
        db=db,
        sport_id="football-uuid",
    )

    assert set(sheet) == {"uuid-mikel"}
    assert sheet["uuid-mikel"]["goals"] == 1
    assert sheet["uuid-mikel"]["minutes"] == 33


def test_sheet_name_fallback_never_matches_a_player_from_another_club():
    """The guard that matters: matching against the whole pool resolved a La
    Liga 'Adrián Rodríguez' onto Bournemouth's 'Á. Rodríguez'. Club scoping
    must drop the row instead of attributing it to the wrong person."""
    from app.services.sync.football_live_sync import _parse_player_sheet

    bournemouth = _NamedPlayer("uuid-wrong", "Á. Rodríguez")
    db = _FakePool({"Bournemouth": [bournemouth], "Alaves": []})

    sheet = _parse_player_sheet(
        _sheet_payload("Alaves", 163060, "Adrián Rodríguez"),
        _FIXTURE,
        lambda api_id: None,
        db=db,
        sport_id="football-uuid",
    )

    assert sheet == {}


def test_sheet_declines_ambiguous_names_within_one_club():
    """Two same-surname team-mates and only an initial to go on -> no guess."""
    from app.services.sync.football_live_sync import _parse_player_sheet

    db = _FakePool({"Alaves": [
        _NamedPlayer("uuid-mikel", "Mikel Rodríguez"),
        _NamedPlayer("uuid-miguel", "Miguel Rodríguez"),
    ]})

    sheet = _parse_player_sheet(
        _sheet_payload("Alaves", 999999, "M. Rodríguez"),
        _FIXTURE,
        lambda api_id: None,
        db=db,
        sport_id="football-uuid",
    )

    assert sheet == {}


def test_sheet_reports_unresolved_players_instead_of_dropping_them_silently(caplog):
    from app.services.sync.football_live_sync import _parse_player_sheet

    with caplog.at_level("WARNING"):
        sheet = _parse_player_sheet(
            _sheet_payload("Getafe", 24882, "Orel Mangala"),
            _FIXTURE,
            lambda api_id: None,
            db=_FakePool({"Getafe": []}),
            sport_id="football-uuid",
        )

    assert sheet == {}
    assert "Orel Mangala" in caplog.text
    assert "1 of 1 entries unresolved" in caplog.text


# ── Confirmed lineups ────────────────────────────────────────────────────────
# The match-state pitch view had no producer at all after the feeder's
# /api/v1/feed/match-lineups was unmounted; sync_football_lineups fills it.


def _lineup_block(team_name, starters, subs):
    return {
        "team": {"id": abs(hash(team_name)) % 1000, "name": team_name},
        "formation": "4-2-3-1",
        "startXI": [{"player": {"id": pid, "name": nm}} for pid, nm in starters],
        "substitutes": [{"player": {"id": pid, "name": nm}} for pid, nm in subs],
    }


def test_parse_lineups_splits_sides_by_home_team_name_not_response_order():
    """Getting sides backwards silently swaps both teams on the pitch, so the
    away block appearing first must not flip them."""
    from app.services.sync.football_live_sync import _parse_lineups

    known = {1: _FakePlayer("u-home-1"), 2: _FakePlayer("u-home-sub"),
             3: _FakePlayer("u-away-1"), 4: _FakePlayer("u-away-sub")}
    payload = {"response": [
        _lineup_block("Rayo Vallecano", [(3, "Away One")], [(4, "Away Sub")]),
        _lineup_block("Sevilla", [(1, "Home One")], [(2, "Home Sub")]),
    ]}

    doc = _parse_lineups(payload, "Sevilla", lambda pid: known.get(pid))

    assert doc["home"] == ["u-home-1"]
    assert doc["home_bench"] == ["u-home-sub"]
    assert doc["away"] == ["u-away-1"]
    assert doc["away_bench"] == ["u-away-sub"]


def test_parse_lineups_returns_none_before_the_provider_publishes():
    """Empty must not be cached — a later tick has to retry."""
    from app.services.sync.football_live_sync import _parse_lineups

    assert _parse_lineups({"response": []}, "Sevilla", lambda pid: None) is None


def test_parse_lineups_reports_unresolved_players_instead_of_hiding_them(caplog):
    from app.services.sync.football_live_sync import _parse_lineups

    known = {1: _FakePlayer("u-1")}
    payload = {"response": [
        _lineup_block("Sevilla", [(1, "Known")], [(99, "Robbie Ure")]),
        _lineup_block("Rayo Vallecano", [], []),
    ]}

    with caplog.at_level("WARNING"):
        doc = _parse_lineups(payload, "Sevilla", lambda pid: known.get(pid))

    assert doc["home"] == ["u-1"]
    assert doc["home_bench"] == []  # dropped...
    assert "Robbie Ure" in caplog.text  # ...but not silently


def test_parse_lineups_always_emits_all_four_keys():
    """The frontend does startingLineups.home.length unguarded, and its
    `?? EMPTY_LINEUPS` fallback won't fire on a truthy partial object."""
    from app.services.sync.football_live_sync import _parse_lineups

    payload = {"response": [_lineup_block("Sevilla", [(1, "Known")], [])]}
    doc = _parse_lineups(payload, "Sevilla", lambda pid: _FakePlayer("u-1"))

    for key in ("home", "away", "home_bench", "away_bench"):
        assert isinstance(doc[key], list), key


def test_parse_lineups_carries_grid_and_played_position():
    """The pitch lays out from the provider's grid; dropping it forced the
    client to infer a shape from stored fantasy positions, which turned a back
    four into a back three whenever one defender was filed as a midfielder."""
    from app.services.sync.football_live_sync import _parse_lineups

    known = {1: _FakePlayer("u-gk"), 2: _FakePlayer("u-lb"), 3: _FakePlayer("u-sub")}
    payload = {"response": [
        {
            "team": {"id": 1, "name": "Sevilla"},
            "formation": "4-2-3-1",
            "startXI": [
                {"player": {"id": 1, "name": "Keeper", "pos": "G", "grid": "1:1"}},
                {"player": {"id": 2, "name": "Left Back", "pos": "D", "grid": "2:1"}},
            ],
            # Bench entries carry a position but no grid.
            "substitutes": [{"player": {"id": 3, "name": "Sub", "pos": "M", "grid": None}}],
        },
        {"team": {"id": 2, "name": "Rayo Vallecano"}, "startXI": [], "substitutes": []},
    ]}

    doc = _parse_lineups(payload, "Sevilla", lambda pid: known.get(pid))

    assert doc["grid"] == {"u-gk": "1:1", "u-lb": "2:1"}
    assert doc["match_position"] == {"u-gk": "G", "u-lb": "D", "u-sub": "M"}
    # Bench players have no slot on the pitch.
    assert "u-sub" not in doc["grid"]


def test_subst_event_reads_the_incoming_player_from_assist():
    """Real payload shape from fixture 1570333: `player` (Davinchi) started,
    so `player` is going off and `assist` is coming on."""
    from app.services.sync.football_live_sync import _subst_ids

    raw = {
        "time": {"elapsed": 46},
        "team": {"id": 546, "name": "Getafe"},
        "player": {"id": 332645, "name": "Davinchi"},
        "assist": {"id": 2482, "name": "E. Unal"},
        "type": "subst",
        "detail": "Substitution 1",
    }
    assert _subst_ids(raw) == (2482, 332645)
    assert _subst_ids({"type": "subst", "player": {"id": 1}}) == (None, 1)
