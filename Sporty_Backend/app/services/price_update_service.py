import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from redis import Redis
from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from app.league.models import Transfer
from app.player.models import Player, PlayerGameweekStat

logger = logging.getLogger(__name__)

MAX_DAILY_DELTA = Decimal("0.10")
DEMAND_WEIGHT = Decimal("0.70")
PERFORMANCE_WEIGHT = Decimal("0.30")


def _clamp_delta(value: Decimal) -> Decimal:
    if value > MAX_DAILY_DELTA:
        return MAX_DAILY_DELTA
    if value < -MAX_DAILY_DELTA:
        return -MAX_DAILY_DELTA
    return value


def _quantize_price(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


async def on_player_price_update(db: Session, redis: Redis, player_id, new_price: Decimal) -> None:
    """Update source-of-truth DB first, then synchronize Redis cache."""
    row = db.query(Player).filter(Player.id == player_id).first()
    if not row:
        return

    row.cost = _quantize_price(new_price)
    db.flush()

    try:
        redis.hset("player:prices", str(player_id), str(row.cost))
    except Exception:
        logger.exception("Failed to sync price cache for player=%s", player_id)


async def update_player_prices(db: Session, redis: Redis) -> dict[str, int]:
    """Hybrid pricing update: 70% demand + 30% performance, capped at ±0.10/day."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)

    # Demand component from recent transfers.
    demand_rows = (
        db.query(
            Transfer.player_in_id.label("player_id"),
            func.count(Transfer.id).label("in_count"),
            cast(0, Integer).label("out_count"),
        )
        .filter(Transfer.created_at >= day_ago)
        .group_by(Transfer.player_in_id)
        .all()
    )
    supply_rows = (
        db.query(
            Transfer.player_out_id.label("player_id"),
            cast(0, Integer).label("in_count"),
            func.count(Transfer.id).label("out_count"),
        )
        .filter(Transfer.created_at >= day_ago)
        .group_by(Transfer.player_out_id)
        .all()
    )

    demand_map: dict = {}
    for row in demand_rows + supply_rows:
        pid = row.player_id
        in_count, out_count = demand_map.get(pid, (0, 0))
        demand_map[pid] = (in_count + int(row.in_count), out_count + int(row.out_count))

    # Performance component: last 3 stat windows, average fantasy points.
    perf_rows = (
        db.query(
            PlayerGameweekStat.player_id,
            func.avg(PlayerGameweekStat.fantasy_points).label("avg_points"),
        )
        .group_by(PlayerGameweekStat.player_id)
        .all()
    )
    perf_map = {row.player_id: Decimal(str(row.avg_points or 0)) for row in perf_rows}

    players = db.query(Player).all()
    updated = 0

    for player in players:
        in_count, out_count = demand_map.get(player.id, (0, 0))
        transfer_volume = max(1, in_count + out_count)
        demand_score = Decimal(in_count - out_count) / Decimal(transfer_volume)

        avg_points = perf_map.get(player.id, Decimal("0"))
        performance_score = (avg_points - Decimal("5")) / Decimal("50")

        blended = (demand_score * DEMAND_WEIGHT) + (performance_score * PERFORMANCE_WEIGHT)
        proposed_delta = _clamp_delta(blended)

        if proposed_delta == 0:
            continue

        new_price = _quantize_price(player.cost + proposed_delta)
        if new_price < Decimal("0.10"):
            new_price = Decimal("0.10")

        await on_player_price_update(db, redis, player.id, new_price)
        updated += 1

    db.commit()
    logger.info("Price update complete: updated=%d total=%d", updated, len(players))
    return {"updated": updated, "total": len(players)}
