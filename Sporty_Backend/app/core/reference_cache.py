"""Redis read-caching for platform reference data.

Sports, active seasons and default scoring rules are three tiny tables that are
read on nearly every page load (league creation, squad rules, rule comparison
views) and written only by an admin, weeks apart. They are the clearest case for
a long TTL: an hour of staleness costs nothing, and the admin writers bust
explicitly so a real edit shows up immediately.

Cycle-free by design — imports only core.redis, so the league, scoring and admin
modules can all use it without import loops.
"""
from __future__ import annotations

from typing import Optional

from fastapi.encoders import jsonable_encoder

from app.core.redis import cache_get, cache_pattern_delete, cache_set

TTL = 3600

_PREFIX = "reference"


def sports_key() -> str:
    return f"{_PREFIX}:sports"


def seasons_key() -> str:
    return f"{_PREFIX}:seasons"


def scoring_rules_key(sport_name: str) -> str:
    return f"{_PREFIX}:scoring_rules:{sport_name}"


def get_cached(key: str) -> Optional[dict | list]:
    return cache_get(key)


def set_cached(key: str, value, ttl: int = TTL) -> None:
    cache_set(key, jsonable_encoder(value), ttl_seconds=ttl)


def bust_all() -> None:
    """Drop every cached reference read.

    Global rather than per-key: the admin writers that call this run at human
    speed, and a season edit can change which sports are active too.
    """
    cache_pattern_delete(f"{_PREFIX}:*")
