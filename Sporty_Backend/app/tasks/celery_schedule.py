"""Celery Beat schedule definitions."""

from celery.schedules import crontab


CELERY_BEAT_SCHEDULE = {
    # Daily sync (players change less often)
    # "sync-football-players-daily": {
    #     "task": "sync.football.players",
    #     "schedule": crontab(minute=0, hour=3),
    #     "args": (39, 2024),
    # },
    # Keep fixtures reasonably fresh
    # "sync-football-matches-hourly": {
    #     "task": "sync.football.matches",
    #     "schedule": crontab(minute=0),
    #     "args": (39, 2024),
    # },
    # Catch just-finished matches
    # "sync-finished-match-stats-every-15m": {
    #     "task": "sync.stats.finished",
    #     "schedule": crontab(minute="*/15"),
    #     "args": (),
    # },
    # Live polling (during match hours this matters; safe if no live matches)
    # "sync-live-match-stats-every-1m": {
    #     "task": "sync.stats.live",
    #     "schedule": crontab(minute="*/1"),
    #     "args": (),
    # },

    # Live polling (distributed-lock protected). Every 4h rather than every
    # minute: RapidAPI free-tier quotas (100 req/day) can't sustain a tight
    # interval, and LIVE_POLLING_ENABLED is off by default anyway (see
    # app/core/config.py) — this only matters once it's flipped on.
    # "poll-live-football-every-4h": {
    #     "task": "live.football.poll",
    #     "schedule": crontab(minute=0, hour="*/4"),
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
