from __future__ import annotations

from app.adapters.basketball import BasketballAdapter
from app.models.schemas.events import EventType, RawEvent, SportType


def test_basketball_normalize_stat_event():
    adapter = BasketballAdapter()

    raw = RawEvent(
        sport=SportType.BASKETBALL,
        match_id="game-123",
        type="STAT",
        payload={
            "event_id": "game-123:p1:STAT:p22:a8:r10",
            "player_id": "p1",
            "team_id": "t1",
            "value": 0.0,
            "points": 22,
            "assists": 8,
            "rebounds": 10,
        },
        timestamp=1710000000000,
    )

    event = adapter.normalize(raw)

    assert event.sport == SportType.BASKETBALL
    assert event.match_id == "game-123"
    assert event.event_type == EventType.STAT
    assert event.player_id == "p1"
    assert event.team_id == "t1"
    assert event.event_id == "game-123:p1:STAT:p22:a8:r10"


def test_basketball_normalize_basket_event_type_mapping():
    adapter = BasketballAdapter()

    raw = RawEvent(
        sport=SportType.BASKETBALL,
        match_id="game-456",
        type="3PT",
        payload={
            "event_id": "game-456:p2:3PT:1",
            "player_id": "p2",
            "team_id": "t2",
            "value": 3.0,
            "points": 3,
        },
        timestamp=1710000001000,
    )

    event = adapter.normalize(raw)

    assert event.event_type == EventType.BASKET
    assert event.value == 3.0
