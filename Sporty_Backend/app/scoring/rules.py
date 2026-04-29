from __future__ import annotations

from collections.abc import Callable

from app.models.schemas.events import EventType, NormalizedEvent, SportType

RuleFunc = Callable[[NormalizedEvent], float]


POINTS_RULES: dict[SportType, dict[EventType, RuleFunc]] = {
    SportType.FOOTBALL: {
        EventType.GOAL: lambda e: 6.0 if e.meta.get("position") == "GK" else 4.0,
        EventType.CARD: lambda e: -3.0 if e.meta.get("card_color") == "red" else -1.0,
        EventType.STAT: lambda e: 3.0 if e.meta.get("stat_type") == "ASSIST" else 0.0,
    },
    SportType.CRICKET: {
        EventType.WICKET: lambda e: 25.0,
        EventType.STAT: lambda e: (
            16.0 if e.meta.get("runs", 0) >= 100 else
            8.0 if e.meta.get("runs", 0) >= 50 else
            float(e.meta.get("runs", 0)) * 0.5
        ),
    },
    SportType.BASKETBALL: {
        EventType.BASKET: lambda e: 2.0 if e.meta.get("points") == 3 else 1.0,
        EventType.STAT: lambda e: (
            float(e.meta.get("assists", 0)) * 1.5 +
            float(e.meta.get("rebounds", 0)) * 1.2
        ),
    },
}
