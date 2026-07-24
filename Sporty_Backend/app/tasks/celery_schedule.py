"""Celery Beat schedule definitions."""

from celery.schedules import crontab


CELERY_BEAT_SCHEDULE = {
    # ── Football via API-Football (free tier: 100 req/day, budget 95 —
    # see FOOTBALL_API_DAILY_BUDGET). All three tasks no-op while
    # LIVE_POLLING_ENABLED / the live_polling_enabled admin flag is off.
    #
    # Daily request math (worst-case EPL Saturday): fixtures 1 + predictions
    # ~10 + live polling ~70 (5-min polls, only inside kickoff windows, 1
    # request per poll since events are embedded) + FT stat sheets ~10 (one
    # /fixtures/players per finished fixture) ≈ 91; the budget guard clips
    # gracefully (FT sheet falls back to event booking). Non-matchdays: ~1.
    "sync-football-matches-daily": {
        "task": "sync.football.matches",
        "schedule": crontab(minute=0, hour=6),
        "args": (),  # league 39 / current season defaults
    },
    "sync-football-predictions-daily": {
        "task": "sync.football.predictions",
        "schedule": crontab(minute=0, hour=7),
        "args": (),
    },
    # Every 5 min all day is safe: the task gates on DB state (fixtures in a
    # live window) before touching the API, so idle runs cost zero requests.
    "poll-live-football-every-5m": {
        "task": "live.football.poll",
        "schedule": crontab(minute="*/5"),
        "args": (),
    },

    # Daily sync (players change less often) — run manually after transfer
    # windows for now; ~40 requests per full-league run (paginated).
    # "sync-football-players-daily": {
    #     "task": "sync.football.players",
    #     "schedule": crontab(minute=0, hour=3),
    #     "args": (),
    # },
    # Catch just-finished matches
    # "sync-finished-match-stats-every-15m": {
    #     "task": "sync.stats.finished",
    #     "schedule": crontab(minute="*/15"),
    #     "args": (),
    # },
    # "poll-live-nba-every-4h": {
    #     "task": "live.nba.poll",
    #     "schedule": crontab(minute=0, hour="*/4"),
    #     "args": (),
    # },
    # "poll-live-cricket-every-1m": {
    #     "task": "live.cricket.poll",
    #     "schedule": crontab(minute="*/1"),
    #     "args": (),
    # },

    # Scoring refresh (safe to run even if no active windows)
    "score-active-transfer-windows-every-10-min": {
        "task": "score.active_transfer_windows",
        "schedule": 600.0,
        "args": (),
    },
    # Auto-lock transfer windows when deadlines pass (every 5 min — cheap
    # work, but each run costs a Redis lock acquire/release against Upstash's
    # free-tier command quota, so every-1-min was more precision than needed)
    "auto-lock-transfer-windows-every-5-min": {
        "task": "transfer.auto_lock_expired",
        "schedule": crontab(minute="*/5"),
        "args": (),
    },
    # Auto-lock lineup windows when deadlines pass (every 5 min, same reason)
    "auto-lock-lineup-windows-every-5-min": {
        "task": "lineup.auto_lock_expired",
        "schedule": crontab(minute="*/5"),
        "args": (),
    },
    # Reprice player market values from recent transfer-window performance.
    "recalculate-player-prices-daily": {
        "task": "pricing.recalculate",
        "schedule": crontab(minute=30, hour=4),
        "args": (3,),
    },
}
