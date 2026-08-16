"""Team match stats: /fixtures/statistics -> the match centre's stat card.

Payload trimmed from the real response for La Liga fixture 1570333
(Alavés 3-0 Getafe, 2026-08-15), captured 2026-08-16.
"""

from types import SimpleNamespace

from app.api.routes.match import _possession_from_team_stats
from app.services.sync.football_live_sync import _parse_team_stats

# Note the response order here is home-then-away, but the parser must not rely
# on it — see test_sides_are_matched_by_team_id_not_response_order.
PAYLOAD = {
    "response": [
        {
            "team": {"id": 542, "name": "Alaves"},
            "statistics": [
                {"type": "Shots on Goal", "value": 8},
                {"type": "Total Shots", "value": 18},
                {"type": "Ball Possession", "value": "52%"},
                {"type": "Passes %", "value": "81%"},
                {"type": "expected_goals", "value": 1.83},
                {"type": "Red Cards", "value": None},
            ],
        },
        {
            "team": {"id": 546, "name": "Getafe"},
            "statistics": [
                {"type": "Shots on Goal", "value": 2},
                {"type": "Total Shots", "value": 6},
                {"type": "Ball Possession", "value": "48%"},
                {"type": "Passes %", "value": "79%"},
                {"type": "expected_goals", "value": 0.24},
                {"type": "Red Cards", "value": 1},
            ],
        },
    ]
}
FIXTURE = {"teams": {"home": {"id": 542}, "away": {"id": 546}}}


def test_stats_are_split_by_side_with_raw_values_preserved():
    doc = _parse_team_stats(PAYLOAD, FIXTURE)
    assert doc["home"]["Total Shots"] == 18
    assert doc["away"]["Total Shots"] == 6
    # Raw, not coerced: "52%" stays a string and xG stays a float, because the
    # UI formats and a coercion here would lose "not reported" (None) vs 0.
    assert doc["home"]["Ball Possession"] == "52%"
    assert doc["home"]["expected_goals"] == 1.83
    assert doc["home"]["Red Cards"] is None
    assert doc["away"]["Red Cards"] == 1


def test_sides_are_matched_by_team_id_not_response_order():
    """The provider doesn't guarantee home first — trusting order would swap
    every stat in the card."""
    reversed_payload = {"response": list(reversed(PAYLOAD["response"]))}
    doc = _parse_team_stats(reversed_payload, FIXTURE)
    assert doc["home"]["Total Shots"] == 18
    assert doc["away"]["Total Shots"] == 6


def test_sides_fall_back_to_team_name_when_ids_are_unavailable():
    """The backfill path has no live fixture payload to take ids from. Our
    home_team/away_team came from this same provider, so the names match — and
    RealTeam.external_api_id is NOT the provider's numeric id (it's a slug like
    'football:sevilla'), so ids cannot be recovered from our side."""
    match = SimpleNamespace(home_team="Alaves", away_team="Getafe")
    doc = _parse_team_stats(PAYLOAD, {}, match)
    assert doc["home"]["Total Shots"] == 18
    assert doc["away"]["Total Shots"] == 6


def test_unknown_teams_are_ignored_rather_than_mislabelled():
    doc = _parse_team_stats(PAYLOAD, {"teams": {"home": {"id": 1}, "away": {"id": 2}}})
    assert doc is None


def test_possession_is_derived_for_the_meter():
    doc = _parse_team_stats(PAYLOAD, FIXTURE)
    assert _possession_from_team_stats(doc) == {"home_pct": 52.0, "away_pct": 48.0}


def test_possession_is_none_when_not_reported():
    """No meter beats a meter reading 0-0."""
    assert _possession_from_team_stats({"home": {}, "away": {}}) is None
    assert _possession_from_team_stats(
        {"home": {"Ball Possession": "52%"}, "away": {"Ball Possession": None}}
    ) is None
