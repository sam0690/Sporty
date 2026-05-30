from __future__ import annotations

import logging
import random
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pulp
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.auth.models import User
from app.core.redis import cache_get, cache_set
from app.league.models import (
    BudgetTransaction,
    FantasyTeam,
    FantasyTeamStatus,
    League,
    LeagueSport,
    LeagueStatus,
    TeamPlayer,
    TransferWindow,
)
from app.league.sportConfigs import (
    DEFAULT_MAX_PER_CLUB,
    SPORT_CONFIGS,
    SUPPORTED_SPORT_TYPES,
    build_auto_pick_sport_config,
    derive_sport_type,
)
from app.player.models import Player, PlayerGameweekStat

logger = logging.getLogger(__name__)

# Controlled randomness for auto-pick selection diversity
AUTO_PICK_JITTER_STRENGTH = 0.55


@dataclass(frozen=True)
class PoolPlayer:
    id: uuid.UUID
    name: str
    sport_type: str
    position: str
    cost: Decimal
    real_team: str
    real_team_id: str | None
    value: Decimal
    is_available: bool

    @property
    def value_per_cost(self) -> Decimal:
        if self.cost <= 0:
            return Decimal("0")
        return self.value / self.cost


def _normalize_sport_name(value: str) -> str:
    return value.strip().lower()


def _league_sport_type(league: League) -> str:
    return derive_sport_type(league.sports)


def _sport_config_for_league(league: League) -> dict[str, Any]:
    sport_type = derive_sport_type(league.sports)
    squad_size = SPORT_CONFIGS[sport_type]["squad_size"]
    config = build_auto_pick_sport_config(
        sport_type,
        total_budget=Decimal(str(league.budget_per_team)),
        squad_size=squad_size,
    )
    config["squad_size"] = squad_size
    return config


def _require_team_free(db: Session, league_id: uuid.UUID, user_id: uuid.UUID) -> None:
    existing_team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == user_id,
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .first()
    )
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a team in this league",
        )


def _active_transfer_window(db: Session, league: League) -> TransferWindow:
    window = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id)
        .filter(TransferWindow.start_at <= func.now())
        .filter(TransferWindow.end_at >= func.now())
        .order_by(TransferWindow.number.desc())
        .first()
    )
    if not window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active transfer window found for this league",
        )
    return window


def _day_seven_locked(window: TransferWindow) -> bool:
    return bool(window.transfers_locked or window.lineup_locked)


def _player_value_map(db: Session, player_ids: list[uuid.UUID]) -> dict[uuid.UUID, Decimal]:
    if not player_ids:
        return {}

    rows = (
        db.query(
            PlayerGameweekStat.player_id.label("player_id"),
            func.avg(PlayerGameweekStat.fantasy_points).label("avg_points"),
        )
        .filter(PlayerGameweekStat.player_id.in_(player_ids))
        .group_by(PlayerGameweekStat.player_id)
        .all()
    )

    return {
        player_id: Decimal(str(avg_points or 0))
        for player_id, avg_points in rows
    }


def _serialize_pool_player(player: PoolPlayer) -> dict[str, Any]:
    return {
        "id": str(player.id),
        "name": player.name,
        "sport_type": player.sport_type,
        "position": player.position,
        "cost": str(player.cost),
        "real_team": player.real_team,
        "real_team_id": player.real_team_id,
        "value": str(player.value),
        "is_available": player.is_available,
    }


def _deserialize_pool_player(raw: dict[str, Any]) -> PoolPlayer:
    return PoolPlayer(
        id=uuid.UUID(str(raw["id"])),
        name=str(raw["name"]),
        sport_type=_normalize_sport_name(str(raw["sport_type"])),
        position=str(raw["position"]),
        cost=Decimal(str(raw["cost"])),
        real_team=str(raw.get("real_team") or "Unknown"),
        real_team_id=str(raw.get("real_team_id")) if raw.get("real_team_id") else None,
        value=Decimal(str(raw.get("value") or "0")),
        is_available=bool(raw.get("is_available", True)),
    )


def _cache_key_for_sport_type(sport_type: str) -> str:
    return f"players:{sport_type}"


def _fetch_player_pool(db: Session, league: League, sport_type: str) -> list[PoolPlayer]:
    logger.info(f"[auto_pick] player pool CACHE MISS sportType={sport_type} — fetching from DB")
    allowed_sport_ids = [league_sport.sport_id for league_sport in league.sports]
    if not allowed_sport_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no sports configured",
        )

    player_ids = [row[0] for row in db.query(Player.id).filter(Player.sport_id.in_(allowed_sport_ids)).all()]
    value_map = _player_value_map(db, player_ids)

    rows = (
        db.query(Player)
        .options(selectinload(Player.sport))
        .filter(Player.sport_id.in_(allowed_sport_ids))
        .all()
    )

    pool: list[PoolPlayer] = []
    for player in rows:
        sport_name = player.sport.name if player.sport and player.sport.name else sport_type
        projected_points = value_map.get(player.id, Decimal("0"))
        player_cost = Decimal(str(player.cost))
        pool.append(
            PoolPlayer(
                id=player.id,
                name=player.name,
                sport_type=_normalize_sport_name(sport_name),
                position=player.position.strip().upper(),
                cost=player_cost,
                real_team=player.real_team,
                real_team_id=str(player.real_team_id) if player.real_team_id else None,
                value=(projected_points / player_cost) if player_cost > 0 else Decimal("0"),
                is_available=bool(player.is_available),
            )
        )
    logger.info(f"[auto_pick] player pool loaded from DB playerCount={len(pool)} sportType={sport_type}")
    return pool


def _load_player_pool(db: Session, league: League, sport_type: str, *, day_seven: bool) -> list[PoolPlayer]:
    cache_key = _cache_key_for_sport_type(sport_type)

    if not day_seven:
        cached = cache_get(cache_key)
        if cached and isinstance(cached, dict):
            raw_players = cached.get("players", [])
            cached_players = [_deserialize_pool_player(row) for row in raw_players if isinstance(row, dict)]
            if sport_type == "basketball" and cached_players:
                live_rows = (
                    db.query(Player.id, Player.is_available)
                    .filter(Player.id.in_([player.id for player in cached_players]))
                    .all()
                )
                live_map = {player_id: bool(is_available) for player_id, is_available in live_rows}
                player_pool = [
                    player
                    for player in cached_players
                    if live_map.get(player.id, False)
                ]
                logger.info(f"[auto_pick] player pool CACHE HIT sportType={sport_type} playerCount={len(player_pool)}")
                return player_pool
            
            player_pool = cached_players
            logger.info(f"[auto_pick] player pool CACHE HIT sportType={sport_type} playerCount={len(player_pool)}")
            return player_pool

    pool = _fetch_player_pool(db, league, sport_type)
    if not day_seven:
        cache_set(
            cache_key,
            {"players": [_serialize_pool_player(player) for player in pool]},
            ttl_seconds=30 * 60,
        )
    return pool


def _sport_lookup(sport_config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {sport["type"]: sport for sport in sport_config["sports"]}


def _club_key(player: PoolPlayer) -> str:
    return player.real_team_id or player.real_team or str(player.id)


def _player_var_name(player_id: uuid.UUID) -> str:
    return f"x_{str(player_id).replace('-', '_')}"


def auto_pick_ilp(
    player_pool: list[PoolPlayer],
    sport_config: dict[str, Any],
    locked_player_ids: list[uuid.UUID] | None = None,
    total_budget: Decimal | float | int | None = None,
) -> list[PoolPlayer]:
    locked_ids = [uuid.UUID(str(player_id)) for player_id in (locked_player_ids or [])]
    if len(set(locked_ids)) != len(locked_ids):
        raise ValueError("Duplicate locked players are not allowed")

    pool_by_id = {player.id: player for player in player_pool}
    selected_locked: list[PoolPlayer] = []
    for locked_id in locked_ids:
        player = pool_by_id.get(locked_id)
        if not player:
            raise ValueError(f"Locked player {locked_id} is not available in the current pool")
        if not player.is_available:
            raise ValueError(f"Locked player {player.name} is not available")
        selected_locked.append(player)

    budget = Decimal(str(total_budget if total_budget is not None else sport_config["totalBudget"]))
    max_per_club = int(sport_config.get("maxPerClub", DEFAULT_MAX_PER_CLUB))
    sport_lookup = _sport_lookup(sport_config)

    # Filter pool to only available players at the start of ILP
    full_pool = player_pool
    player_pool = [p for p in full_pool if p.is_available]

    # BREAKDOWN LOGS
    available_count = len(player_pool)
    unavailable_count = len(full_pool) - available_count
    sport_counts = Counter(p.sport_type for p in player_pool if p.is_available)
    position_counts = Counter(p.position for p in player_pool if p.is_available)

    logger.info(f"[auto_pick] pool breakdown — available={available_count} unavailable={unavailable_count}")
    logger.info(f"[auto_pick] pool by sport — {dict(sport_counts)}")
    logger.info(f"[auto_pick] pool by position — {dict(position_counts)}")

    sport_type = sport_config.get("sportType", "unknown")
    logger.info(f"[auto_pick] squad_size={sport_config['squad_size']} sportType={sport_type}")
    logger.info(f"[auto_pick] ILP solve START poolSize={len(player_pool)}")

    # Apply controlled randomness jitter to selection objective
    random.seed()
    jitter_strength = AUTO_PICK_JITTER_STRENGTH
    jittered_values = {}
    for player in player_pool:
        jitter = 1 + random.uniform(-jitter_strength, jitter_strength)
        jittered_values[player.id] = float(player.value) * jitter

    logger.info(f"[auto_pick] jitter applied strength={jitter_strength}")

    model = pulp.LpProblem("auto_pick", pulp.LpMaximize)
    variables = {
        player.id: pulp.LpVariable(_player_var_name(player.id), cat=pulp.LpBinary)
        for player in player_pool
    }

    # Objective: maximize jittered value
    model += pulp.lpSum(jittered_values[player.id] * variables[player.id] for player in player_pool)

    # Total squad size constraint
    model += pulp.lpSum(variables[player.id] for player in player_pool) == int(sport_config["squad_size"])

    for locked_id in locked_ids:
        if locked_id in variables:
            model += variables[locked_id] == 1

    # Budget constraint with a small epsilon for floating-point safety
    model += pulp.lpSum(float(player.cost) * variables[player.id] for player in player_pool) <= float(budget) + 1e-8

    for sport in sport_config["sports"]:
        sport_type = sport["type"]
        sport_players = [player for player in player_pool if player.sport_type == sport_type]
        if len(sport_players) < int(sport["quota"]):
            raise ValueError(
                f"{sport_type.title()} quota not met: expected {sport['quota']}, got {len(sport_players)}"
            )

        model += pulp.lpSum(variables[player.id] for player in sport_players) == int(sport["quota"])

        position_minimums = sport.get("position_minimums") or {
            position: 1 for position in sport.get("positions", [])
        }
        for position, minimum in position_minimums.items():
            pos_players = [player for player in sport_players if player.position == position]
            if len(pos_players) < int(minimum):
                raise ValueError(
                    f"{sport_type.title()} squad cannot satisfy required position {position}"
                )
            model += pulp.lpSum(variables[player.id] for player in pos_players) >= int(minimum)

    clubs = sorted({_club_key(player) for player in player_pool})
    for club in clubs:
        club_players = [player for player in player_pool if _club_key(player) == club]
        model += pulp.lpSum(variables[player.id] for player in club_players) <= max_per_club

    status_code = model.solve(pulp.PULP_CBC_CMD(msg=0))
    status_name = pulp.LpStatus.get(status_code, "Unknown")
    
    if status_name != "Optimal":
        logger.error(f"[auto_pick] ILP solve FAILED status={status_name}")
        logger.error(f"[auto_pick] constraints at failure — budget={budget} sports={sport_config['sports']} maxPerClub={max_per_club}")
        logger.error(f"[auto_pick] pool at failure — total={len(player_pool)} by_sport={dict(sport_counts)} by_position={dict(position_counts)}")
        raise ValueError(
            "No valid squad exists within the given constraints. "
            "Check budget, available players, and position coverage."
        )

    selected = [player for player in player_pool if pulp.value(variables[player.id]) >= 0.5]
    if len(selected) != sum(int(sport["quota"]) for sport in sport_config["sports"]):
        raise ValueError("ILP did not return a complete squad")

    total_cost = sum(p.cost for p in selected)
    budget_remaining = budget - total_cost

    selected_by_sport = Counter(p.sport_type for p in selected)
    selected_by_position = Counter(p.position for p in selected)

    logger.info(f"[auto_pick] ILP solve SUCCESS status={status_name} selectedCount={len(selected)} totalCost={total_cost} budgetRemaining={budget_remaining}")
    logger.info(f"[auto_pick] selected by sport — {dict(selected_by_sport)}")
    logger.info(f"[auto_pick] selected by position — {dict(selected_by_position)}")

    return selected


def validate_squad(squad: list[PoolPlayer], sport_config: dict[str, Any]) -> None:
    if len(squad) != int(sport_config["squad_size"]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Squad must have exactly {sport_config['squad_size']} players, got {len(squad)}",
        )

    sport_lookup = _sport_lookup(sport_config)
    selected_by_sport: dict[str, list[PoolPlayer]] = defaultdict(list)
    for player in squad:
        selected_by_sport[player.sport_type].append(player)

    total_cost = sum((player.cost for player in squad), Decimal("0"))
    if total_cost > Decimal(str(sport_config["totalBudget"])):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Selected squad exceeds the available budget",
        )

    for sport_type, sport in sport_lookup.items():
        players = selected_by_sport.get(sport_type, [])
        if len(players) != int(sport["quota"]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{sport_type.title()} quota not met: expected {sport['quota']}, got {len(players)}",
            )

        position_counts = Counter(player.position for player in players)
        position_minimums = sport.get("position_minimums") or {
            position: 1 for position in sport.get("positions", [])
        }
        missing_positions = [
            position
            for position, minimum in position_minimums.items()
            if position_counts.get(position, 0) < int(minimum)
        ]
        if missing_positions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{sport_type.title()} squad is missing required positions: {', '.join(missing_positions)}",
            )

        club_counts: dict[str, int] = defaultdict(int)
        for player in players:
            club_counts[_club_key(player)] += 1
        over_limit = [club for club, count in club_counts.items() if count > int(sport_config.get("maxPerClub", DEFAULT_MAX_PER_CLUB))]
        if over_limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{sport_type.title()} club limit exceeded for: {', '.join(over_limit)}",
            )


def autoPickSquad(
    playerPool: list[PoolPlayer],
    sportConfig: dict[str, Any],
    lockedPlayerIds: list[uuid.UUID] | None = None,
) -> tuple[list[PoolPlayer], Decimal, Decimal]:
    selected = auto_pick_ilp(
        playerPool,
        sportConfig,
        locked_player_ids=lockedPlayerIds,
        total_budget=sportConfig["totalBudget"],
    )
    validate_squad(selected, sportConfig)
    total_cost = sum((player.cost for player in selected), Decimal("0"))
    budget_remaining = Decimal(str(sportConfig["totalBudget"])) - total_cost
    return selected, total_cost, budget_remaining


def auto_pick_team(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
    locked_player_ids: list[uuid.UUID] | None = None,
) -> dict[str, Any]:
    league = (
        db.query(League)
        .options(selectinload(League.sports).selectinload(LeagueSport.sport))
        .filter(League.id == league_id)
        .first()
    )
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    if league.status not in {LeagueStatus.SETUP, LeagueStatus.ACTIVE}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Auto-pick is only available for setup or active leagues",
        )

    window = _active_transfer_window(db, league)
    if _day_seven_locked(window):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auto-pick is disabled during the transfer window",
        )

    sport_config = _sport_config_for_league(league)
    sport_type = sport_config["sportType"]
    pool = _load_player_pool(db, league, sport_type, day_seven=False)
    try:
        selected, total_cost, budget_remaining = autoPickSquad(
            pool,
            sport_config,
            locked_player_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    return {
        "players": [
            {
                "id": player.id,
                "name": player.name,
                "sport_type": player.sport_type,
                "position": player.position,
                "cost": player.cost,
            }
            for player in selected
        ],
        "totalCost": total_cost,
        "budgetRemaining": budget_remaining,
    }
