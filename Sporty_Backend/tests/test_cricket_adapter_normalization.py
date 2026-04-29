from __future__ import annotations

from app.adapters.cricket import CricketAdapter
from app.models.schemas.events import EventType, RawEvent, SportType


def test_cricket_normalize_wicket_event():
    adapter = CricketAdapter()

    raw = RawEvent(
        sport=SportType.CRICKET,
        match_id="cric-1",
        type="WICKET",
        payload={
            "event_id": "cric-1:p9:WICKET:w2",
            "player_id": "p9",
            "team_id": "t1",
            "wickets": 2,
            "value": 2,
        },
        timestamp=1710000000000,
    )

    event = adapter.normalize(raw)

    assert event.event_type == EventType.WICKET
    assert event.player_id == "p9"
    assert event.value == 2.0


def test_cricket_normalize_stat_event():
    adapter = CricketAdapter()

    raw = RawEvent(
        sport=SportType.CRICKET,
        match_id="cric-2",
        type="STAT",
        payload={
            "event_id": "cric-2:p7:STAT:r45:b32",
            "player_id": "p7",
            "team_id": "t2",
            "runs": 45,
            "value": 45,
        },
        timestamp=1710000001000,
    )

    event = adapter.normalize(raw)

    assert event.event_type == EventType.STAT
    assert event.player_id == "p7"
    assert event.value == 45.0
