# Guards app/scoring/rules.py (Kafka points-engine) against drifting from the
# batch gameweek engine's point values (app/services/scoring/player_scoring.py)
# and the feeder live-points bridge (app/services/feed_scoring.py) — all three
# must total the same fantasy points for the same match.

from app.models.schemas.events import EventType, NormalizedEvent, SportType
from app.scoring.rules import POINTS_RULES


def _event(sport: SportType, event_type: EventType, **meta) -> NormalizedEvent:
    return NormalizedEvent(
        sport=sport,
        match_id="m1",
        event_type=event_type,
        player_id="p1",
        team_id="t1",
        value=1.0,
        meta=meta,
        ts=0,
        event_id="e1",
    )


def test_football_matches_batch_actions():
    rules = POINTS_RULES[SportType.FOOTBALL]
    assert rules[EventType.GOAL](_event(SportType.FOOTBALL, EventType.GOAL)) == 5.0
    assert rules[EventType.STAT](_event(SportType.FOOTBALL, EventType.STAT, stat_type="ASSIST")) == 3.0
    assert rules[EventType.CARD](_event(SportType.FOOTBALL, EventType.CARD, card_color="yellow")) == -1.0
    assert rules[EventType.CARD](_event(SportType.FOOTBALL, EventType.CARD, card_color="red")) == -2.0


def test_basketball_matches_nba_formula():
    rules = POINTS_RULES[SportType.BASKETBALL]
    assert rules[EventType.BASKET](_event(SportType.BASKETBALL, EventType.BASKET, points=3)) == 0.9
    assert rules[EventType.BASKET](_event(SportType.BASKETBALL, EventType.BASKET, points=2)) == 0.6
    assert rules[EventType.BASKET](_event(SportType.BASKETBALL, EventType.BASKET, points=1)) == 0.3
    stat = rules[EventType.STAT](_event(
        SportType.BASKETBALL, EventType.STAT, assists=10, rebounds=1, steals=1, blocks=1,
    ))
    assert stat == 10 * 0.2 + 1.0 + 2.0 + 2.0


if __name__ == "__main__":
    test_football_matches_batch_actions()
    test_basketball_matches_nba_formula()
    print("ok")
