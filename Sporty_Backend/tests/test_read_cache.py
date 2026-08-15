"""read_cache bust coverage.

Three call sites (scoring/engine.py, scoring/trigger.py, sync/player_sync.py)
used to delete `leaderboard:{id}:{window}` / `players:{sport}` — key namespaces
that nothing ever writes. The real cache lives under `league_read:*`, so the
scoring path never actually invalidated the leaderboard and relied entirely on
the 30s TTL. This pins the contract: whatever `set_cached` writes for a league,
`bust_league` removes — for every leaderboard variant — and leaves other
leagues alone.
"""
from __future__ import annotations

import fnmatch
import uuid

import pytest

from app.core import redis as core_redis
from app.league import read_cache


class _FakeRedis:
    """Minimal Redis stand-in: the four commands the cache helpers use."""

    def __init__(self):
        self.store: dict[str, str] = {}

    def get(self, key: str):
        return self.store.get(key)

    def setex(self, key: str, _ttl: int, value: str):
        self.store[key] = value
        return True

    def delete(self, *keys: str) -> int:
        return sum(self.store.pop(k, None) is not None for k in keys)

    def scan_iter(self, match: str = "*", count: int = 10):
        # list() so deleting while iterating is safe, as the real SCAN is.
        yield from [k for k in list(self.store) if fnmatch.fnmatch(k, match)]


@pytest.fixture
def fake_redis(monkeypatch) -> _FakeRedis:
    fake = _FakeRedis()
    monkeypatch.setattr(core_redis, "get_redis", lambda: fake)
    return fake


def _seed_league(league_id: uuid.UUID, window_id: uuid.UUID) -> list[str]:
    """Write every leaderboard variant + power-rankings for one league."""
    keys = [
        read_cache.leaderboard_key(league_id, window_id, False, None),
        read_cache.leaderboard_key(league_id, window_id, True, None),
        read_cache.leaderboard_key(league_id, window_id, False, 7),
        read_cache.leaderboard_key(league_id, None, False, None),
        read_cache.power_rankings_key(league_id),
    ]
    for key in keys:
        read_cache.set_cached(key, {"entries": [{"team": "a", "points": 1}]}, 30)
    return keys


def test_bust_league_removes_every_leaderboard_variant(fake_redis):
    league_id, window_id = uuid.uuid4(), uuid.uuid4()
    keys = _seed_league(league_id, window_id)

    assert all(read_cache.get_cached(k) is not None for k in keys)

    read_cache.bust_league(league_id)

    for key in keys:
        assert read_cache.get_cached(key) is None, f"{key} survived the bust"


def test_bust_league_leaves_other_leagues_alone(fake_redis):
    window_id = uuid.uuid4()
    mine, theirs = uuid.uuid4(), uuid.uuid4()
    _seed_league(mine, window_id)
    their_keys = _seed_league(theirs, window_id)

    read_cache.bust_league(mine)

    for key in their_keys:
        assert read_cache.get_cached(key) is not None, f"{key} was collateral damage"


def test_set_cached_survives_uuid_and_decimal(fake_redis):
    """jsonable_encoder is why UUID/Decimal payloads round-trip at all —
    plain json.dumps raises on both."""
    from decimal import Decimal

    key = read_cache.power_rankings_key(uuid.uuid4())
    player_id = uuid.uuid4()
    read_cache.set_cached(key, [{"player_id": player_id, "cost": Decimal("4.5")}], 60)

    cached = read_cache.get_cached(key)
    assert cached == [{"player_id": str(player_id), "cost": 4.5}]


def test_player_bust_all_clears_every_player_read(fake_redis):
    """Repricing/scoring/sync call bust_all() — it has to reach the opaque
    filter-hash list keys too, which is why it is a prefix wipe."""
    from app.player import read_cache as player_read_cache
    from app.player.schemas import PlayerFilter

    player_id, gameweek_id = uuid.uuid4(), uuid.uuid4()
    keys = [
        player_read_cache.list_key(PlayerFilter(page=1, page_size=20)),
        player_read_cache.list_key(PlayerFilter(page=2, page_size=20)),
        player_read_cache.detail_key(player_id),
        player_read_cache.price_history_key(player_id, 20),
        player_read_cache.recent_stats_key(player_id, 5),
        player_read_cache.gameweek_stats_key(gameweek_id, "football"),
        player_read_cache.teams_key("football"),
    ]
    for key in keys:
        player_read_cache.set_cached(key, {"items": []}, 300)

    # A neighbouring namespace must survive — bust_all is prefix-scoped.
    read_cache.set_cached(read_cache.power_rankings_key(uuid.uuid4()), {"a": 1}, 60)

    player_read_cache.bust_all()

    for key in keys:
        assert player_read_cache.get_cached(key) is None, f"{key} survived bust_all"
    assert any(k.startswith("league_read:") for k in fake_redis.store)


def test_player_list_key_distinguishes_every_filter_field(fake_redis):
    """The key is a hash of the whole filter model — two filters that differ in
    any single field must not share a cache entry."""
    from app.player import read_cache as player_read_cache
    from app.player.schemas import PlayerFilter

    base = PlayerFilter(page=1, page_size=20)
    variants = [
        PlayerFilter(page=2, page_size=20),
        PlayerFilter(page=1, page_size=50),
        PlayerFilter(page=1, page_size=20, sport_name="football"),
        PlayerFilter(page=1, page_size=20, position="MID"),
        PlayerFilter(page=1, page_size=20, search="salah"),
        PlayerFilter(page=1, page_size=20, league_id=uuid.uuid4()),
    ]
    keys = {player_read_cache.list_key(f) for f in [base, *variants]}
    assert len(keys) == len(variants) + 1


def test_cache_pattern_delete_scans_and_batches(fake_redis):
    """Exercises the SCAN path past one batch (KEYS used to block the server)."""
    for i in range(1200):
        fake_redis.store[f"league_read:leaderboard:x:{i}"] = "{}"
    fake_redis.store["league_read:power_rankings:keep"] = "{}"

    deleted = core_redis.cache_pattern_delete("league_read:leaderboard:x:*")

    assert deleted == 1200
    assert fake_redis.store == {"league_read:power_rankings:keep": "{}"}
