from __future__ import annotations

from collections.abc import Callable

from app.models.schemas.events import EventType, NormalizedEvent, SportType

RuleFunc = Callable[[NormalizedEvent], float]


POINTS_RULES: dict[SportType, dict[EventType, RuleFunc]] = {
    # Football/basketball values mirror the batch gameweek engine
    # (app/services/scoring/player_scoring.py FOOTBALL_ACTIONS / NBA formula)
    # and the feeder live-points bridge (app/services/feed_scoring.py), so a
    # match scored through this pipeline totals the same as one scored via
    # either of those paths. Cricket is untouched (separate mismatch, not
    # requested here).
    SportType.FOOTBALL: {
        EventType.GOAL: lambda e: 5.0,
        EventType.CARD: lambda e: -2.0 if e.meta.get("card_color") == "red" else -1.0,
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
        # points: 3 -> three, 2 -> two, 1 -> free throw; scaled per NBA_ACTIONS
        # (3 pts per 10 points -> 0.3/pt).
        EventType.BASKET: lambda e: {1: 0.3, 2: 0.6, 3: 0.9}.get(int(e.meta.get("points", 2)), 0.6),
        EventType.STAT: lambda e: (
            float(e.meta.get("assists", 0)) * 0.2 +
            float(e.meta.get("rebounds", 0)) * 1.0 +
            float(e.meta.get("steals", 0)) * 2.0 +
            float(e.meta.get("blocks", 0)) * 2.0
        ),
    },
}
