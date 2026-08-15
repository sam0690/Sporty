"""Redis read-caching for player reference data.

Player rows are read on every market/draft/transfer view by every user in every
league, but they only change when a sync, a repricing run, or a scoring run
writes to them — minutes-to-hours apart, never per-request. So: cache with a
volatility-tiered TTL AND bust from the writers (pricing/repricing, admin price
edits, player sync, the scoring engine) so a new price shows up immediately
rather than after the TTL. The TTL is the safety net for anything that mutates
players outside those paths.

Deliberately a near-copy of app/league/read_cache.py rather than a shared
abstraction — two 60-line modules are cheaper to read than one generic one.

Cycle-free by design — imports only core.redis, so routers and any writer
service can use it without import loops.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from typing import Optional

from fastapi.encoders import jsonable_encoder

from app.core.redis import cache_get, cache_pattern_delete, cache_set

# Tiered by how fast the underlying rows actually move.
LIST_TTL = 300          # /players — moves on repricing + sync
DETAIL_TTL = 300        # /players/{id}
RECENT_STATS_TTL = 300  # follows scoring
PRICE_HISTORY_TTL = 900 # append-only, one row per repricing run
GAMEWEEK_STATS_TTL = 3600  # immutable once the gameweek is scored
TEAMS_TTL = 3600        # a few dozen rows, changes on promotion/relegation

_PREFIX = "player_read"


def list_key(filters) -> str:
    """Key for GET /players.

    Hashes the whole filter model rather than naming fields, so adding a field
    to PlayerFilter can never silently collide two different result sets.
    """
    payload = json.dumps(jsonable_encoder(filters), sort_keys=True)
    digest = hashlib.sha1(payload.encode()).hexdigest()[:16]
    return f"{_PREFIX}:list:{digest}"


def detail_key(player_id: uuid.UUID) -> str:
    return f"{_PREFIX}:detail:{player_id}"


def price_history_key(player_id: uuid.UUID, limit: int) -> str:
    return f"{_PREFIX}:price_history:{player_id}:{limit}"


def recent_stats_key(player_id: uuid.UUID, limit: int) -> str:
    return f"{_PREFIX}:recent_stats:{player_id}:{limit}"


def gameweek_stats_key(gameweek_id: uuid.UUID, sport: str) -> str:
    return f"{_PREFIX}:gw_stats:{gameweek_id}:{sport}"


def teams_key(sport_name: str | None) -> str:
    return f"{_PREFIX}:teams:{sport_name or 'all'}"


def get_cached(key: str) -> Optional[dict | list]:
    return cache_get(key)


def set_cached(key: str, value, ttl: int) -> None:
    # jsonable_encoder handles the UUID/Decimal/datetime in these payloads;
    # the router's response_model coerces the plain types back on the way out.
    cache_set(key, jsonable_encoder(value), ttl_seconds=ttl)


def bust_all() -> None:
    """Drop every cached player read.

    Deliberately global rather than per-player: repricing and scoring rewrite
    thousands of rows at once, and the list keys are opaque filter hashes that
    cannot be mapped back to the players they contain. Callers are batch jobs
    that run minutes apart, so the blunt bust costs nothing.
    """
    cache_pattern_delete(f"{_PREFIX}:*")
