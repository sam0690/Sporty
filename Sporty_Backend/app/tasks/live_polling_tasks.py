"""Live polling Celery tasks.

These run on a tight schedule (e.g., every minute) and should be protected
by Redis locks so only one worker executes them at a time.

Football and NBA now have real polling implementations (see
app/services/sync/football_live_sync.py, nba_live_sync.py), gated behind
settings.LIVE_POLLING_ENABLED (default False) — while it's off, both return
immediately as a no-op, same as before. Live match data currently comes from
the SportyDataFeeder simulator instead (app/api/v1/feed.py). Cricket
(sync_cricket_live_matches) remains an unimplemented stub.
"""

from __future__ import annotations

from typing import Any

from celery import shared_task

from app.core.redis_lock import redis_lock
from app.tasks._async_bridge import run_async
from app.database import SessionLocal
from app.services.sync.cricket_live_sync import sync_cricket_live_matches
from app.services.sync.football_live_sync import (
    backfill_football_team_stats,
    rebook_football_match_stats,
    sync_football_lineups,
    sync_football_live_matches,
)
from app.services.sync.nba_live_sync import sync_nba_live_matches
from app.services.sync.sportscore_live_sync import sync_sportscore_live


# Shared bridge: see app/tasks/_async_bridge.py for the loop/Redis caveat.
_run_async = run_async


@shared_task(name="live.football.poll")
def poll_live_football_task() -> dict[str, Any]:
    lock_key = "lock:live:football:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.football.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_football_live_matches(db))
            return {"ok": True, "task": "live.football.poll", "result": result}
        finally:
            db.close()


@shared_task(name="sync.football.team_stats_backfill")
def backfill_team_stats_task() -> dict[str, Any]:
    """Catch fixtures whose team stats were skipped for budget. Daily, just
    after the provider's 00:00 UTC quota reset, when the budget is fresh."""
    lock_key = "lock:sync:football:team-stats-backfill"
    with redis_lock(lock_key, ttl_seconds=300) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held",
                    "task": "sync.football.team_stats_backfill"}

        db = SessionLocal()
        try:
            result = _run_async(backfill_football_team_stats(db))
            return {"ok": True, "task": "sync.football.team_stats_backfill", "result": result}
        finally:
            db.close()


@shared_task(name="sync.football.stats_rebook")
def rebook_match_stats_task() -> dict[str, Any]:
    """Re-parse the FT sheet for recently finished matches. Catches players the
    sheet couldn't resolve at finish (provider id drift) and the provider's own
    post-match corrections — booking otherwise happens once and never again."""
    lock_key = "lock:sync:football:stats-rebook"
    with redis_lock(lock_key, ttl_seconds=300) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held",
                    "task": "sync.football.stats_rebook"}

        db = SessionLocal()
        try:
            result = _run_async(rebook_football_match_stats(db))
            return {"ok": True, "task": "sync.football.stats_rebook", "result": result}
        finally:
            db.close()


@shared_task(name="live.sportscore.poll")
def poll_live_sportscore_task() -> dict[str, Any]:
    """60-second display-only tick (SportScore, keyless). Separate lock from
    live.football.poll on purpose — the two providers run independently, and a
    stalled API-Football poll must never hold up liveness."""
    lock_key = "lock:live:sportscore:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.sportscore.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_sportscore_live(db))
            return {"ok": True, "task": "live.sportscore.poll", "result": result}
        finally:
            db.close()


@shared_task(name="sync.football.lineups")
def sync_football_lineups_task() -> dict[str, Any]:
    lock_key = "lock:live:football:lineups"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "sync.football.lineups"}

        db = SessionLocal()
        try:
            result = _run_async(sync_football_lineups(db))
            return {"ok": True, "task": "sync.football.lineups", "result": result}
        finally:
            db.close()


@shared_task(name="live.nba.poll")
def poll_live_nba_task() -> dict[str, Any]:
    lock_key = "lock:live:nba:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.nba.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_nba_live_matches(db))
            return {"ok": True, "task": "live.nba.poll", "result": result}
        finally:
            db.close()


@shared_task(name="live.cricket.poll")
def poll_live_cricket_task() -> dict[str, Any]:
    lock_key = "lock:live:cricket:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.cricket.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_cricket_live_matches(db))
            return {"ok": True, "task": "live.cricket.poll", "result": result}
        finally:
            db.close()
