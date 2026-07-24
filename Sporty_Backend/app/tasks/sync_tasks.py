"""Celery task wrappers around the existing async sync services.

These tasks run in a Celery worker process and execute the async
coroutines via asyncio.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from celery import shared_task

from app.core.redis_lock import redis_lock
from app.database import SessionLocal
from app.services.sync.football_live_sync import sync_football_predictions
from app.services.sync.match_sync import sync_football_matches
from app.services.sync.player_sync import sync_football_players
from app.services.sync.stats_sync import sync_finished_match_stats, sync_live_match_stats


def _current_football_season() -> int:
    """API-Football season year: the year the season kicked off (2026-27 -> 2026).
    European seasons roll over in summer, so July onward is the new season."""
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 7 else now.year - 1


def _run_async(coro: Any):
    """Run an async coroutine from a sync context."""
    try:
        return asyncio.run(coro)
    except RuntimeError as exc:
        # Defensive fallback if called from an already-running loop
        if "asyncio.run() cannot be called from a running event loop" not in str(exc):
            raise
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


@shared_task(name="sync.football.players")
def sync_football_players_task(league_id: int = 39, season: int | None = None) -> dict[str, Any]:
    season = season or _current_football_season()
    lock_key = f"lock:sync:football:players:league:{league_id}:season:{season}"
    with redis_lock(lock_key, ttl_seconds=60 * 30) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "sync.football.players"}

        db = SessionLocal()
        try:
            _run_async(sync_football_players(db, league_id=league_id, season=season))
            return {"ok": True, "task": "sync.football.players", "league_id": league_id, "season": season}
        finally:
            db.close()


@shared_task(name="sync.football.matches")
def sync_football_matches_task(league_id: int = 39, season: int | None = None) -> dict[str, Any]:
    season = season or _current_football_season()
    lock_key = f"lock:sync:football:matches:league:{league_id}:season:{season}"
    with redis_lock(lock_key, ttl_seconds=60 * 10) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "sync.football.matches"}

        db = SessionLocal()
        try:
            _run_async(sync_football_matches(db, league_id=league_id, season=season))
            return {"ok": True, "task": "sync.football.matches", "league_id": league_id, "season": season}
        finally:
            db.close()


@shared_task(name="sync.football.predictions")
def sync_football_predictions_task() -> dict[str, Any]:
    lock_key = "lock:sync:football:predictions"
    with redis_lock(lock_key, ttl_seconds=60 * 10) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "sync.football.predictions"}

        db = SessionLocal()
        try:
            result = _run_async(sync_football_predictions(db))
            return {"ok": True, "task": "sync.football.predictions", "result": result}
        finally:
            db.close()


@shared_task(name="sync.stats.finished")
def sync_finished_stats_task() -> dict[str, Any]:
    lock_key = "lock:sync:stats:finished"
    with redis_lock(lock_key, ttl_seconds=60 * 10) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "sync.stats.finished"}

        db = SessionLocal()
        try:
            _run_async(sync_finished_match_stats(db))
            return {"ok": True, "task": "sync.stats.finished"}
        finally:
            db.close()


@shared_task(name="sync.stats.live")
def sync_live_stats_task() -> dict[str, Any]:
    lock_key = "lock:sync:stats:live"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "sync.stats.live"}

        db = SessionLocal()
        try:
            _run_async(sync_live_match_stats(db))
            return {"ok": True, "task": "sync.stats.live"}
        finally:
            db.close()
