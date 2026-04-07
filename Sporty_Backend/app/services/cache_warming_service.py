import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from redis import Redis
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.league.models import FantasyTeam, League, LeagueSport, LeagueStatus, TeamPlayer, Sport
from app.player.models import Player

logger = logging.getLogger(__name__)


def _to_str_decimal(value: Decimal) -> str:
    return str(value)


async def warm_cache(db: Session, redis: Redis) -> dict[str, int]:
    """Warm Redis caches for prices, teams, budgets, and transfer rules."""
    # 1) Player prices in one hash.
    players = db.query(Player.id, Player.cost).all()

    # 2) Active team rosters for each user in one query.
    team_rows = (
        db.query(FantasyTeam.user_id, TeamPlayer.player_id)
        .join(TeamPlayer, TeamPlayer.fantasy_team_id == FantasyTeam.id)
        .filter(TeamPlayer.released_window_id.is_(None))
        .all()
    )

    # 3) Budgets grouped by user (sum across user teams for a single user-level cache key).
    budget_rows = (
        db.query(FantasyTeam.user_id, func.coalesce(func.sum(FantasyTeam.current_budget), 0))
        .group_by(FantasyTeam.user_id)
        .all()
    )

    # 4) Sport-level transfer rules (max transfers_per_window seen for active leagues of the sport).
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

    team_by_user: dict[str, set[str]] = defaultdict(set)
    for user_id, player_id in team_rows:
        team_by_user[str(user_id)].add(str(player_id))

    budget_by_user: dict[str, str] = {
        str(user_id): _to_str_decimal(total_budget) for user_id, total_budget in budget_rows
    }

    pipe = redis.pipeline(transaction=False)

    # player:prices hash
    if players:
        mapping = {str(player_id): _to_str_decimal(cost) for player_id, cost in players}
        pipe.delete("player:prices")
        pipe.hset("player:prices", mapping=mapping)

    # team:{userId} set + budget:{userId}
    for user_id, player_ids in team_by_user.items():
        key = f"team:{user_id}"
        pipe.delete(key)
        if player_ids:
            pipe.sadd(key, *sorted(player_ids))

    for user_id, budget in budget_by_user.items():
        pipe.set(f"budget:{user_id}", budget)

    # transfer_rules:{sport} with TTL
    for sport_id, transfers_per_window in rules_rows:
        sport_name = sport_map.get(sport_id)
        if not sport_name:
            continue
        payload = {
            "transfers_per_window": int(transfers_per_window or 0),
            "max_total": 15,
            "max_starters": 9,
            "max_bench": 6,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        rules_key = f"transfer_rules:{sport_name}"
        pipe.setex(rules_key, 86400, json.dumps(payload))

    pipe.execute()

    logger.info(
        "Cache warming completed: players=%d users=%d rules=%d",
        len(players),
        len(team_by_user),
        len(rules_rows),
    )
    return {
        "players": len(players),
        "users": len(team_by_user),
        "rules": len(rules_rows),
    }
