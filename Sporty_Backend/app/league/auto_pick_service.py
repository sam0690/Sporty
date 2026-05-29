from __future__ import annotations

import logging
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

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
from app.player.models import Player, PlayerGameweekStat


logger = logging.getLogger(__name__)


SUPPORTED_SPORT_TYPES = {"football", "basketball"}
DEFAULT_MAX_PER_CLUB = 3
MIXED_QUOTAS = {"football": 8, "basketball": 7}
DEFAULT_POSITIONS: dict[str, list[str]] = {
    "football": ["GK", "DEF", "MID", "FWD"],
    "basketball": ["PG", "SG", "SF", "PF", "C"],
}


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


def _league_sport_names(league: League) -> list[str]:
    sport_names: list[str] = []
    for league_sport in league.sports:
        sport = league_sport.sport
        if not sport or not sport.name:
            continue
        sport_name = _normalize_sport_name(sport.name)
        if sport_name in SUPPORTED_SPORT_TYPES:
            sport_names.append(sport_name)
    return sport_names


def _league_sport_type(league: League) -> str:
    sport_names = _league_sport_names(league)
    if not sport_names:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no supported sports configured",
        )
    if len(set(sport_names)) > 1:
        return "mixed"
    return sport_names[0]


def _sport_config_for_league(league: League) -> dict[str, Any]:
    sport_type = _league_sport_type(league)
    total_budget = Decimal(str(league.budget_per_team))

    if sport_type == "mixed":
        sports = [
            {
                "type": "football",
                "quota": MIXED_QUOTAS["football"],
                "positions": DEFAULT_POSITIONS["football"],
                "maxPerClub": DEFAULT_MAX_PER_CLUB,
            },
            {
                "type": "basketball",
                "quota": MIXED_QUOTAS["basketball"],
                "positions": DEFAULT_POSITIONS["basketball"],
                "maxPerClub": DEFAULT_MAX_PER_CLUB,
            },
        ]
    else:
        sports = [
            {
                "type": sport_type,
                "quota": int(league.squad_size),
                "positions": DEFAULT_POSITIONS[sport_type],
                "maxPerClub": DEFAULT_MAX_PER_CLUB,
            }
        ]

    return {
        "sportType": sport_type,
        "totalBudget": total_budget,
        "sports": sports,
    }


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
        pool.append(
            PoolPlayer(
                id=player.id,
                name=player.name,
                sport_type=_normalize_sport_name(sport_name),
                position=player.position.strip().upper(),
                cost=Decimal(str(player.cost)),
                real_team=player.real_team,
                real_team_id=str(player.real_team_id) if player.real_team_id else None,
                value=value_map.get(player.id, Decimal("0")),
                is_available=bool(player.is_available),
            )
        )
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
                return [
                    player
                    for player in cached_players
                    if live_map.get(player.id, False)
                ]
            return cached_players

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


def _selected_counts(selected: list[PoolPlayer]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for player in selected:
        counts[player.sport_type] += 1
    return counts


def _selected_positions(selected: list[PoolPlayer]) -> dict[str, set[str]]:
    positions: dict[str, set[str]] = defaultdict(set)
    for player in selected:
        positions[player.sport_type].add(player.position)
    return positions


def _candidate_score(
    player: PoolPlayer,
    selected_counts: dict[str, int],
    sport_lookup: dict[str, dict[str, Any]],
) -> tuple[Decimal, Decimal, Decimal]:
    sport = sport_lookup.get(player.sport_type)
    if not sport:
        return (Decimal("0"), Decimal("0"), Decimal("0"))

    quota = Decimal(str(sport["quota"]))
    remaining_quota = max(Decimal(str(sport["quota"])) - Decimal(str(selected_counts.get(player.sport_type, 0))), Decimal("0"))
    pressure = remaining_quota / quota if quota > 0 else Decimal("0")
    # Prefer lower-cost players while still biasing toward the sport that has
    # the most quota pressure left. This keeps the squad affordable enough to
    # finish before the budget runs out.
    return (pressure, -player.cost, player.value_per_cost)


def _reservation_by_sport(
    pool: list[PoolPlayer],
    sport_config: dict[str, Any],
    selected: list[PoolPlayer],
) -> dict[str, Decimal]:
    if sport_config["sportType"] != "mixed":
        return {sport["type"]: Decimal("0") for sport in sport_config["sports"]}

    selected_positions = _selected_positions(selected)
    selected_ids = {player.id for player in selected}
    reservations: dict[str, Decimal] = {}
    for sport in sport_config["sports"]:
        sport_type = sport["type"]
        needed_positions = [
            position
            for position in sport["positions"]
            if position not in selected_positions.get(sport_type, set())
        ]
        reserve = Decimal("0")
        for position in needed_positions:
            candidates = [
                player
                for player in pool
                if player.sport_type == sport_type
                and player.position == position
                and player.id not in selected_ids
                and player.is_available
            ]
            if not candidates:
                continue
            reserve += min(player.cost for player in candidates)
        reservations[sport_type] = reserve
    return reservations


def _candidate_rejection_reason(
    player: PoolPlayer,
    playerPool: list[PoolPlayer],
    sport_lookup: dict[str, dict[str, Any]],
    selected: list[PoolPlayer],
    selected_counts: dict[str, int],
    sport_players: list[PoolPlayer],
    sport: dict[str, Any] | None,
    sport_config: dict[str, Any],
    selected_ids: set[uuid.UUID],
) -> str | None:
    if player.id in selected_ids:
        return "already_selected"
    if not sport:
        return "unsupported_sport"
    if selected_counts.get(player.sport_type, 0) >= int(sport["quota"]):
        return "sport_quota_filled"
    if player.position not in sport["positions"]:
        return "position_not_allowed"

    club_count = Counter(_club_key(existing) for existing in sport_players)
    if club_count[_club_key(player)] >= int(sport["maxPerClub"]):
        return "club_limit"

    post_pick_selected = selected + [player]
    post_pick_remaining_budget = Decimal(str(sport_config["totalBudget"])) - sum(
        (existing.cost for existing in post_pick_selected), Decimal("0")
    )
    post_pick_completion_cost = _minimum_completion_cost(
        playerPool=playerPool,
        sport_config=sport_config,
        selected=post_pick_selected,
    )
    if post_pick_completion_cost is None:
        return "completion_impossible"
    if post_pick_remaining_budget < post_pick_completion_cost:
        return "budget_reserve"

    return None


def _minimum_completion_cost(
    playerPool: list[PoolPlayer],
    sport_config: dict[str, Any],
    selected: list[PoolPlayer],
) -> Decimal | None:
    """Return the cheapest estimated cost to complete the squad.

    This is a lower bound: it reserves the cheapest players needed to
    satisfy each sport's remaining quota and required positions. If any
    required position or quota slot cannot be filled from the remaining
    pool, returns None.
    """
    selected_ids = {player.id for player in selected}
    selected_counts = _selected_counts(selected)
    selected_positions = _selected_positions(selected)
    total = Decimal("0")

    for sport in sport_config["sports"]:
        sport_type = sport["type"]
        remaining_quota = int(sport["quota"]) - selected_counts.get(sport_type, 0)
        if remaining_quota <= 0:
            continue

        available = [
            player
            for player in playerPool
            if player.sport_type == sport_type
            and player.is_available
            and player.id not in selected_ids
        ]
        if len(available) < remaining_quota:
            return None

        reserved_ids: set[uuid.UUID] = set()
        missing_positions = [
            position
            for position in sport["positions"]
            if position not in selected_positions.get(sport_type, set())
        ]

        for position in missing_positions:
            candidates = [
                player
                for player in available
                if player.position == position and player.id not in reserved_ids
            ]
            if not candidates:
                return None
            chosen = min(candidates, key=lambda candidate: candidate.cost)
            total += chosen.cost
            reserved_ids.add(chosen.id)

        fillers_needed = remaining_quota - len(missing_positions)
        if fillers_needed > 0:
            filler_candidates = [
                player
                for player in available
                if player.id not in reserved_ids
            ]
            if len(filler_candidates) < fillers_needed:
                return None
            filler_candidates.sort(key=lambda candidate: candidate.cost)
            total += sum(
                (player.cost for player in filler_candidates[:fillers_needed]),
                Decimal("0"),
            )

    return total


def validate_squad(squad: list[PoolPlayer], sport_config: dict[str, Any]) -> None:
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

        selected_positions = {player.position for player in players}
        missing_positions = [position for position in sport["positions"] if position not in selected_positions]
        if missing_positions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{sport_type.title()} squad is missing required positions: {', '.join(missing_positions)}",
            )

        club_counts: dict[str, int] = defaultdict(int)
        for player in players:
            club_counts[_club_key(player)] += 1
        over_limit = [club for club, count in club_counts.items() if count > int(sport["maxPerClub"])]
        if over_limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{sport_type.title()} club limit exceeded for: {', '.join(over_limit)}",
            )


def _auto_pick_debug_snapshot(
    pool: list[PoolPlayer],
    selected: list[PoolPlayer],
    sport_config: dict[str, Any],
) -> dict[str, Any]:
    sport_lookup = _sport_lookup(sport_config)
    selected_by_sport = Counter(player.sport_type for player in selected)
    pool_by_sport = Counter(player.sport_type for player in pool)
    available_by_sport = Counter(
        player.sport_type for player in pool if player.is_available
    )

    return {
        "sportType": sport_config.get("sportType"),
        "totalBudget": str(sport_config.get("totalBudget")),
        "sports": [
            {
                "type": sport_type,
                "quota": sport["quota"],
                "selected": selected_by_sport.get(sport_type, 0),
                "pool": pool_by_sport.get(sport_type, 0),
                "available": available_by_sport.get(sport_type, 0),
            }
            for sport_type, sport in sport_lookup.items()
        ],
        "selectedPlayers": [
            {
                "id": str(player.id),
                "name": player.name,
                "sportType": player.sport_type,
                "position": player.position,
                "cost": str(player.cost),
                "realTeam": player.real_team,
                "isAvailable": player.is_available,
            }
            for player in selected
        ],
    }


def autoPickSquad(
    playerPool: list[PoolPlayer],
    sportConfig: dict[str, Any],
    lockedPlayerIds: list[uuid.UUID] | None = None,
) -> tuple[list[PoolPlayer], Decimal, Decimal]:
    locked_ids = {uuid.UUID(str(player_id)) for player_id in (lockedPlayerIds or [])}
    pool_by_id = {player.id: player for player in playerPool}
    selected: list[PoolPlayer] = []

    for locked_id in locked_ids:
        player = pool_by_id.get(locked_id)
        if not player:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Locked player {locked_id} is not available in the current pool",
            )
        if not player.is_available:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Locked player {player.name} is not available",
            )
        selected.append(player)

    if len({player.id for player in selected}) != len(selected):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Duplicate locked players are not allowed",
        )

    sport_lookup = _sport_lookup(sportConfig)
    selected_ids = {player.id for player in selected}
    selected_counts = _selected_counts(selected)

    candidate_pool = [
        player
        for player in playerPool
        if player.id not in selected_ids and player.is_available
    ]

    while True:
        unfilled_sports = {
            sport_type
            for sport_type, sport in sport_lookup.items()
            if selected_counts.get(sport_type, 0) < int(sport["quota"])
        }
        if not unfilled_sports:
            break

        candidate_pool.sort(
            key=lambda player: _candidate_score(player, selected_counts, sport_lookup),
            reverse=True,
        )

        picked = False
        rejection_counts: Counter[str] = Counter()
        for player in candidate_pool:
            sport = sport_lookup.get(player.sport_type)
            sport_players = [existing for existing in selected if existing.sport_type == player.sport_type]
            reason = _candidate_rejection_reason(
                player=player,
                playerPool=playerPool,
                sport_lookup=sport_lookup,
                selected=selected,
                selected_counts=selected_counts,
                sport_players=sport_players,
                sport=sport,
                sport_config=sportConfig,
                selected_ids=selected_ids,
            )
            if reason:
                rejection_counts[reason] += 1
                continue

            selected.append(player)
            selected_ids.add(player.id)
            selected_counts[player.sport_type] += 1
            picked = True
            break

        if not picked:
            logger.warning(
                "Auto-pick stalled before validation: selected_counts=%s rejection_counts=%s selected=%s",
                dict(selected_counts),
                dict(rejection_counts),
                [
                    {
                        "id": str(player.id),
                        "sportType": player.sport_type,
                        "position": player.position,
                        "cost": str(player.cost),
                        "realTeam": player.real_team,
                    }
                    for player in selected
                ],
            )
            break

    try:
        validate_squad(selected, sportConfig)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT:
            logger.warning(
                "Auto-pick validation failed: %s | debug=%s",
                exc.detail,
                _auto_pick_debug_snapshot(playerPool, selected, sportConfig),
            )
        raise
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

    _require_team_free(db, league_id, current_user.id)

    window = _active_transfer_window(db, league)
    if _day_seven_locked(window):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auto-pick is disabled during the transfer window",
        )

    sport_config = _sport_config_for_league(league)
    sport_type = sport_config["sportType"]
    pool = _load_player_pool(db, league, sport_type, day_seven=False)
    selected, total_cost, budget_remaining = autoPickSquad(pool, sport_config, locked_player_ids)

    first_window = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id)
        .order_by(TransferWindow.number.asc())
        .first()
    )
    if not first_window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No transfer windows exist for this season",
        )

    team = FantasyTeam(
        league_id=league.id,
        user_id=current_user.id,
        name=current_user.username or "Auto Pick Team",
        current_budget=budget_remaining,
        starting_budget=Decimal(str(league.budget_per_team)),
        starting_squad_size=len(selected),
    )
    db.add(team)
    db.flush()

    for player in selected:
        db.add(
            BudgetTransaction(
                fantasy_team_id=team.id,
                player_id=player.id,
                transaction_type="purchase",
                amount=player.cost,
                penalty_applied=Decimal("0.00"),
            )
        )
        db.add(
            TeamPlayer(
                fantasy_team_id=team.id,
                player_id=player.id,
                sport_type=player.sport_type,
                acquired_window_id=first_window.id,
                cost_at_acquisition=player.cost,
            )
        )

    db.flush()

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
