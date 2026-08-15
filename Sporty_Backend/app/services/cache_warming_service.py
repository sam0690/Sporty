"""Daily Redis cache warming (APScheduler, 00:05).

Scope note: this job used to also warm `player:prices` (a hash of every
player's cost), `team:{user_id}` and `budget:{user_id}`. All three were
write-only — nothing in the codebase ever read them back, and
transfer_service._player_price documents a deliberate refusal to trust
`player:prices` because nothing invalidated it when repricing changed
Player.cost. They were dropped rather than wired up: player reads are now
served by app/player/read_cache.py, which the repricing/admin/sync/scoring
writers bust explicitly.

What remains is `transfer_rules:{sport}`, which transfer_service._transfer_rules
genuinely reads.
"""
import json
import logging
from datetime import datetime, timezone

from redis import Redis
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.league.models import League, LeagueSport, LeagueStatus, Sport
from app.league.sportConfigs import get_squad_size

logger = logging.getLogger(__name__)


async def warm_cache(db: Session, redis: Redis) -> dict[str, int]:
    """Warm the sport-level transfer-rules cache."""
    # Sport-level transfer rules (max transfers_per_window seen for active
    # leagues of the sport).
    rules_rows = (
        db.query(
            LeagueSport.sport_id,
            func.max(League.transfers_per_window).label("transfers_per_window"),
        )
        .join(League, League.id == LeagueSport.league_id)
        .filter(League.status == LeagueStatus.ACTIVE)
        .group_by(LeagueSport.sport_id)
        .all()
    )

    sport_name_rows = db.query(Sport.id, Sport.name).all()
    sport_map = {sport_id: sport_name for sport_id, sport_name in sport_name_rows}

    pipe = redis.pipeline(transaction=False)

    for sport_id, transfers_per_window in rules_rows:
        sport_name = sport_map.get(sport_id)
        if not sport_name:
            continue
        payload = {
            "transfers_per_window": int(transfers_per_window or 0),
            "max_total": get_squad_size(sport_name),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        pipe.setex(f"transfer_rules:{sport_name}", 86400, json.dumps(payload))

    pipe.execute()

    logger.info("Cache warming completed: rules=%d", len(rules_rows))
    return {"rules": len(rules_rows)}
