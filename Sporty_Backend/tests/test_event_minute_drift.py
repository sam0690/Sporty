"""API-Football revises an event's minute and detail between reads.

event_id embeds both, so a revised event lands under a new id, the unique
constraint can't see it, and ON CONFLICT DO NOTHING happily inserts a second
copy. Real case, fixture 1570337: two yellows moved 27'->26' and 68'->67', and
four 60' substitutions swapped their "Substitution 1"/"Substitution 2" labels.
"""

from types import SimpleNamespace

from app.services.sync.football_live_sync import _drop_drifted_duplicates


class _StubDB:
    """Stands in for the (query -> filter -> all) chain the guard uses."""

    def __init__(self, stored):
        self._stored = stored

    def query(self, *_):
        return self

    def filter(self, *_):
        return self

    def all(self):
        return self._stored


def _stored(event_type, player_id, minute):
    return SimpleNamespace(
        event_type=event_type,
        player_id=player_id,
        meta={"minute": minute, "source": "api-football"},
    )


def _candidate(event_type, player_id, minute, event_id="new"):
    return {
        "event_id": event_id,
        "event_type": event_type,
        "player_id": player_id,
        "meta": {"minute": minute, "source": "api-football"},
    }


def _ids(rows):
    return [r["event_id"] for r in rows]


def test_drops_a_card_whose_minute_drifted_by_one():
    db = _StubDB([_stored("yellow_card", "p1", 27)])
    rows = [_candidate("yellow_card", "p1", 26, "drifted")]
    assert _drop_drifted_duplicates(db, "1570337", rows) == []


def test_drops_a_substitution_relabelled_at_the_same_minute():
    """Same sub, same minute, only `detail` changed — a new event_id either way."""
    db = _StubDB([_stored("substitution", "p1", 60)])
    rows = [_candidate("substitution", "p1", 60, "relabelled")]
    assert _drop_drifted_duplicates(db, "1570337", rows) == []


def test_keeps_the_genuinely_missing_tail():
    """The whole point: events after the last in-play poll must still land."""
    db = _StubDB([_stored("yellow_card", "p1", 27), _stored("substitution", "p2", 60)])
    rows = [
        _candidate("goal", "p3", 76, "goal-76"),
        _candidate("assist", "p4", 76, "assist-76"),
        _candidate("substitution", "p5", 85, "sub-85"),
    ]
    assert _ids(_drop_drifted_duplicates(db, "1570337", rows)) == [
        "goal-76",
        "assist-76",
        "sub-85",
    ]


def test_same_player_beyond_the_window_is_a_different_event():
    """Two yellows 10 minutes apart are two bookings, not one drifted one."""
    db = _StubDB([_stored("yellow_card", "p1", 27)])
    rows = [_candidate("yellow_card", "p1", 37, "second-booking")]
    assert _ids(_drop_drifted_duplicates(db, "1570337", rows)) == ["second-booking"]


def test_different_player_same_minute_is_not_a_duplicate():
    db = _StubDB([_stored("yellow_card", "p1", 27)])
    rows = [_candidate("yellow_card", "p2", 27, "other-player")]
    assert _ids(_drop_drifted_duplicates(db, "1570337", rows)) == ["other-player"]


def test_first_write_for_a_fixture_is_untouched():
    assert _ids(_drop_drifted_duplicates(_StubDB([]), "1570337", [_candidate("goal", "p1", 5)])) == [
        "new"
    ]
