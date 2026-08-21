"""SportScore incident mapping — pure functions, recorded payloads, no DB.

The payloads below are trimmed copies of real responses captured 2026-08-16
from sportscore.com/api/widget/match/?slug=deportivo-alaves-vs-getafe.
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.sync.sportscore_live_sync import (
    build_event_rows,
    payload_matches_fixture,
    their_status,
)
from app.services.sync.sportscore_teams import SPORTSCORE_TEAM_SLUGS, build_match_slug

NOW = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)

INCIDENTS = [
    {"time": 5, "type": "Yellow card", "side": "away", "player": "Tiago Coser", "is_card": True},
    {"time": 20, "type": "Substitution", "side": "away", "player": "",
     "is_sub": True, "player_in": "JP Chermont", "player_out": "Tinga"},
    {"time": 43, "type": "Goal", "side": "home", "player": "Pablo Maia",
     "is_goal": True, "home_score": 1, "away_score": 0},
    {"time": 60, "type": "Corner", "side": "home", "player": "Someone"},
]


def _resolver(known: dict):
    """known: {(name, club): player-ish}. Anything else is unresolvable, which
    is the common case for this provider."""
    def resolve(name, club):
        return known.get((name, club))
    return resolve


def test_incidents_map_to_our_event_types_and_skip_unknown_ones():
    rows, _ = build_event_rows(
        live_key="1570333", home_team="Alaves", away_team="Getafe",
        incidents=INCIDENTS, resolve=_resolver({}), now=NOW,
    )
    # "Corner" is not a scoring/feed event type we render — dropped, not passed
    # through as a mystery whistle glyph.
    assert [r["event_type"] for r in rows] == ["yellow_card", "substitution", "goal"]
    assert all(r["event_id"].startswith("ss:") for r in rows)
    assert all(r["meta"]["source"] == "sportscore" for r in rows)


def test_substitution_puts_the_incoming_player_first():
    """Same contract as the API-Football path: player_id is coming ON,
    meta.related_player_id is coming OFF."""
    coming_on = SimpleNamespace(id="in-uuid")
    coming_off = SimpleNamespace(id="out-uuid")
    rows, subs = build_event_rows(
        live_key="1570333", home_team="Alaves", away_team="Getafe",
        incidents=[INCIDENTS[1]],
        resolve=_resolver({
            ("JP Chermont", "Getafe"): coming_on,
            ("Tinga", "Getafe"): coming_off,
        }),
        now=NOW,
    )
    row = rows[0]
    assert row["player_id"] == "in-uuid"
    assert row["meta"]["related_player_id"] == "out-uuid"
    assert row["meta"]["player_name"] == "JP Chermont"
    assert row["meta"]["related_player_name"] == "Tinga"
    assert subs[0]["player_in_name"] == "JP Chermont"
    assert subs[0]["player_out_name"] == "Tinga"


def test_unresolved_players_keep_their_name_and_carry_no_id():
    """The provider has no ids at all, so most players won't resolve. Those
    events must still be displayable — and must stay inert for scoring, which
    is exactly what an empty player_id buys."""
    rows, _ = build_event_rows(
        live_key="1570333", home_team="Alaves", away_team="Getafe",
        incidents=[INCIDENTS[2]], resolve=_resolver({}), now=NOW,
    )
    assert rows[0]["player_id"] == ""
    assert rows[0]["meta"]["player_name"] == "Pablo Maia"


def test_event_ids_are_stable_across_identical_ticks():
    """Re-ticking the same fixture must collide on (match_id, event_id) so the
    upsert is a no-op — otherwise every 60s tick re-fires points and messages."""
    first, _ = build_event_rows(
        live_key="1570333", home_team="Alaves", away_team="Getafe",
        incidents=INCIDENTS, resolve=_resolver({}), now=NOW,
    )
    second, _ = build_event_rows(
        live_key="1570333", home_team="Alaves", away_team="Getafe",
        incidents=INCIDENTS, resolve=_resolver({}),
        now=NOW + timedelta(minutes=1),
    )
    assert [r["event_id"] for r in first] == [r["event_id"] for r in second]


def test_side_maps_to_our_team_names_not_theirs():
    """EventFeed attributes an event to a side by exact string match against the
    snapshot's home_team/away_team, so these must be OUR names."""
    rows, _ = build_event_rows(
        live_key="1570333", home_team="Alaves", away_team="Getafe",
        incidents=INCIDENTS, resolve=_resolver({}), now=NOW,
    )
    assert rows[0]["meta"]["team"] == "Getafe"   # side: away
    assert rows[2]["meta"]["team"] == "Alaves"   # side: home


def test_payload_from_the_other_leg_is_refused():
    """One slug serves BOTH legs of a fixture pair, so the kickoff time is the
    only thing standing between us and ingesting the reverse fixture."""
    match = SimpleNamespace(
        home_team="Alaves", away_team="Getafe",
        match_date=datetime(2026, 8, 15, 17, 30, tzinfo=timezone.utc),
    )
    assert payload_matches_fixture({"time": "2026-08-15T17:30:00+00:00"}, match)
    assert not payload_matches_fixture({"time": "2027-01-10T20:00:00+00:00"}, match)
    # Missing/unparseable time degrades to "accept" rather than killing all
    # live coverage on a provider format change.
    assert payload_matches_fixture({}, match)


def test_status_never_claims_more_than_it_knows():
    assert their_status({"status": "finished"}) == "finished"
    assert their_status({"status": "upcoming"}) == "upcoming"
    assert their_status({"status": "inprogress"}) == "live"


def test_match_slug_is_built_from_their_club_naming():
    # Our "Alaves" is their "deportivo-alaves" — the whole reason the map exists.
    assert build_match_slug("Alaves", "Getafe") == "deportivo-alaves-vs-getafe"
    assert build_match_slug("Alaves", "Not A Club") is None


def test_every_stored_club_name_is_slug_mapped():
    """SPORTSCORE_TEAM_SLUGS must be keyed on the name we STORE in
    Match.home_team — the POST-_FDO_NAME_ALIASES short form — not
    football-data.org's long name.

    Regression guard: the Premier League block was keyed on the long names
    ("Brighton & Hove Albion") while match_sync stores the short ones
    ("Brighton"), so build_match_slug returned None and eight clubs' fixtures
    were dropped at sportscore_live_sync.py's `if slug:` gate. They got zero
    60-second coverage and fell back to the hourly API-Football poll, which
    looked like "only one of two live matches is updating".

    Only La Liga/Bundesliga were correct, and the existing slug test used a La
    Liga pair, so nothing failed.
    """
    from app.services.sync.match_sync import _FDO_NAME_ALIASES

    unmapped = sorted(
        stored for stored in _FDO_NAME_ALIASES.values()
        if stored not in SPORTSCORE_TEAM_SLUGS
    )
    assert not unmapped, (
        "these clubs are stored under a name with no SportScore slug, so their "
        f"fixtures get no live coverage: {unmapped}"
    )


def test_slug_map_is_not_keyed_on_pre_alias_names():
    """The inverse check: a long-form key is dead weight that reads as coverage."""
    from app.services.sync.match_sync import _FDO_NAME_ALIASES

    stale = sorted(k for k in SPORTSCORE_TEAM_SLUGS if k in _FDO_NAME_ALIASES)
    assert not stale, (
        f"slug map keyed on pre-alias names that never reach it: {stale}"
    )
