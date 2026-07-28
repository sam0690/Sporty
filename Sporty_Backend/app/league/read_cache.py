"""Redis read-caching for league leaderboard / power-rankings.

These are pure functions of persisted TeamWeeklyScore rows: expensive to
compute (multi-join + correlated subqueries), recomputed on every page view,
and only change when the scoring engine writes new scores/ranks. So: cache
with a short TTL AND bust precisely from the ranking writer
(scoring/ranking.py) so a fresh score shows up immediately rather than after
the TTL. The TTL is just a safety net for anything that mutates scores outside
that path.

Cycle-free by design — imports only core.redis, so the writer, the leaderboard
service, and the power-rankings service can all use it without import loops.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi.encoders import jsonable_encoder

from app.core.redis import cache_get, cache_pattern_delete, cache_set

# Short TTLs (see the audit): a leaderboard tolerates a few seconds of
# staleness; the writer-side bust makes real changes appear immediately anyway.
LEADERBOARD_TTL = 30
POWER_RANKINGS_TTL = 60

_PREFIX = "league_read"


def leaderboard_key(
    league_id: uuid.UUID,
    window_id: uuid.UUID | None,
    historical: bool,
    gameweek: int | None,
) -> str:
    return f"{_PREFIX}:leaderboard:{league_id}:{window_id}:{historical}:{gameweek}"


def power_rankings_key(league_id: uuid.UUID) -> str:
    return f"{_PREFIX}:power_rankings:{league_id}"


def get_cached(key: str) -> Optional[dict | list]:
    return cache_get(key)


def set_cached(key: str, value, ttl: int) -> None:
    # jsonable_encoder handles the UUID/Decimal/datetime in these payloads;
    # the router's response_model coerces the plain types back on the way out.
    cache_set(key, jsonable_encoder(value), ttl_seconds=ttl)


def bust_league(league_id: uuid.UUID) -> None:
    """Drop every cached leaderboard variant + power-rankings for one league."""
    cache_pattern_delete(f"{_PREFIX}:leaderboard:{league_id}:*")
    cache_pattern_delete(power_rankings_key(league_id))
