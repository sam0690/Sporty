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
