import json
import logging
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from redis import Redis
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.models import User
from app.league.models import (
    BudgetTransaction,
    FantasyTeam,
    League,
    LeagueSport,
    LeagueStatus,
    Sport,
    TeamPlayer,
    Transfer,
    TransferWindow,
)
from app.player.models import Player
from app.services.budget_utils import calculate_refund
from app.services.transfer_session_service import clear_session, get_session, save_session

logger = logging.getLogger(__name__)

SUPPORTED_TRANSFER_POOL_SPORTS = {"football", "basketball"}
MULTISPORT_MAX_PLAYERS_BY_SPORT: dict[str, int] = {
    "football": 8,
    "basketball": 7,
}


def _safe_hget(redis: Redis, key: str, field: str) -> str | None:
    try:
        return redis.hget(key, field)
    except Exception:
        logger.exception("Redis hget failed key=%s field=%s", key, field)
        return None


def _safe_get(redis: Redis, key: str) -> str | None:
    try:
        return redis.get(key)
    except Exception:
        logger.exception("Redis get failed key=%s", key)
        return None


def _safe_sismember(redis: Redis, key: str, value: str) -> bool | None:
    try:
        return bool(redis.sismember(key, value))
    except Exception:
        logger.exception("Redis sismember failed key=%s", key)
        return None


def _require_league_and_team(db: Session, league_id: uuid.UUID, current_user: User) -> tuple[League, FantasyTeam]:
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    if league.status != LeagueStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="League is not ACTIVE")

    team = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id, FantasyTeam.user_id == current_user.id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fantasy team not found")
    return league, team


def _league_supported_sport_ids(db: Session, league_id: uuid.UUID) -> set[uuid.UUID]:
    rows = (
        db.query(LeagueSport.sport_id)
        .join(Sport, LeagueSport.sport_id == Sport.id)
        .filter(
            LeagueSport.league_id == league_id,
            Sport.name.in_(SUPPORTED_TRANSFER_POOL_SPORTS),
        )
        .all()
    )
    return {row[0] for row in rows}


def _league_supported_sports(db: Session, league_id: uuid.UUID) -> list[Sport]:
    return (
        db.query(Sport)
        .join(LeagueSport, LeagueSport.sport_id == Sport.id)
        .filter(
            LeagueSport.league_id == league_id,
            Sport.name.in_(SUPPORTED_TRANSFER_POOL_SPORTS),
        )
        .all()
    )


def _is_multisport_league(db: Session, league_id: uuid.UUID) -> bool:
    sport_names = {
        sport.name.strip().lower()
        for sport in _league_supported_sports(db, league_id)
        if sport.name
    }
    return len(sport_names) > 1


def _sport_counts_for_player_ids(db: Session, player_ids: set[str]) -> dict[str, int]:
    if not player_ids:
        return {}

    player_uuids = [uuid.UUID(player_id) for player_id in player_ids]
    rows = (
        db.query(Player.id, Sport.name)
        .join(Sport, Player.sport_id == Sport.id)
        .filter(Player.id.in_(player_uuids))
        .all()
    )

    counts: dict[str, int] = {}
    for _player_id, sport_name in rows:
        key = (sport_name or "").strip().lower()
        if not key:
            continue
        counts[key] = counts.get(key, 0) + 1
    return counts


def _ensure_player_allowed_for_league_pool(
    db: Session,
    league_id: uuid.UUID,
    player_id: uuid.UUID,
) -> None:
    allowed_sport_ids = _league_supported_sport_ids(db, league_id)
    if not allowed_sport_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no supported sports configured for transfers",
        )

    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    if player.sport_id not in allowed_sport_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Player is outside this league's allowed player pool",
        )


def _current_window_id(db: Session, league: League) -> uuid.UUID:
    row = (
        db.query(TransferWindow.id)
        .filter(
            TransferWindow.season_id == league.season_id,
            TransferWindow.start_at <= func.now(),
            TransferWindow.end_at >= func.now(),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No active transfer window")
    return row[0]


def _player_price(db: Session, redis: Redis, player_id: uuid.UUID) -> Decimal:
    cached = _safe_hget(redis, "player:prices", str(player_id))
    if cached is not None:
        return Decimal(cached)

    row = db.query(Player.cost).filter(Player.id == player_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return row[0]


def _transfer_rules(db: Session, redis: Redis, sport_name: str, league: League) -> dict:
    raw = _safe_get(redis, f"transfer_rules:{sport_name}")
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            logger.exception("Invalid transfer rules JSON for sport=%s", sport_name)

    # DB fallback: use league-level setting and defaults.
    return {
        "transfers_per_window": int(league.transfers_per_window),
        "max_total": 15,
        "max_starters": 9,
        "max_bench": 6,
    }


def _build_new_session(
    db: Session,
    league: League,
    team: FantasyTeam,
    user_id: str,
    gameweek_id: str,
) -> dict:
    team_players = (
        db.query(TeamPlayer.player_id)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    original_team = [str(row[0]) for row in team_players]

    return {
        "userId": user_id,
        "leagueId": str(league.id),
        "gameweekId": gameweek_id,
        "originalBudget": float(team.current_budget),
        "currentBudget": float(team.current_budget),
        "originalTeam": original_team,
        "pendingOut": [],
        "pendingIn": [],
        "transfersAllowed": int(league.transfers_per_window),
        "transfersUsed": 0,
    }


def stage_out(
    db: Session,
    redis: Redis,
    league_id: uuid.UUID,
    gameweek_id: uuid.UUID,
    player_id: uuid.UUID,
    current_user: User,
) -> dict[str, float | int]:
    league, team = _require_league_and_team(db, league_id, current_user)
    row_out = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.player_id == player_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .first()
    )
    if not row_out:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Player is not on your team")

    refund, _penalty = calculate_refund(row_out.cost_at_acquisition)

    user_id = str(current_user.id)
    session = get_session(redis, user_id)
    if not session or session.get("leagueId") != str(league_id) or session.get("gameweekId") != str(gameweek_id):
        session = _build_new_session(db, league, team, user_id, str(gameweek_id))

    player_str = str(player_id)
    if player_str not in session["originalTeam"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Player is not on your team")
    if player_str not in session["pendingOut"]:
        session["pendingOut"].append(player_str)

    session["currentBudget"] = float(Decimal(str(session["currentBudget"])) + refund)

    # League-scoped sport for rules key.
    league_sport = (
        db.query(LeagueSport)
        .filter(LeagueSport.league_id == league.id)
        .first()
    )
    sport_key = league_sport.sport.name if league_sport and league_sport.sport else "football"
    rules = _transfer_rules(db, redis, sport_key, league)

    session["transfersAllowed"] = int(rules.get("transfers_per_window", league.transfers_per_window))
    save_session(redis, user_id, session)

    return {
        "currentBudget": float(session["currentBudget"]),
        "transfersAllowed": int(session["transfersAllowed"]),
        "transfersUsed": int(session["transfersUsed"]),
    }


def stage_in(
    db: Session,
    redis: Redis,
    league_id: uuid.UUID,
    gameweek_id: uuid.UUID,
    player_id: uuid.UUID,
    current_user: User,
) -> dict[str, float | int]:
    league, team = _require_league_and_team(db, league_id, current_user)
    is_multisport_league = _is_multisport_league(db, league_id)
    _ensure_player_allowed_for_league_pool(db, league_id, player_id)
    price = _player_price(db, redis, player_id)

    league_sport = (
        db.query(LeagueSport)
        .filter(LeagueSport.league_id == league.id)
        .first()
    )
    sport_key = league_sport.sport.name if league_sport and league_sport.sport else "football"
    rules = _transfer_rules(db, redis, sport_key, league)
    max_total = int(rules.get("max_total", 15))

    user_id = str(current_user.id)
    session = get_session(redis, user_id)
    if not session or session.get("leagueId") != str(league_id) or session.get("gameweekId") != str(gameweek_id):
        session = _build_new_session(db, league, team, user_id, str(gameweek_id))

    player_str = str(player_id)

    # Compute effective squad from this transfer session to avoid stale/global
    # Redis membership false positives and correctly account for pending changes.
    effective_team_ids = set(session.get("originalTeam", []))
    effective_team_ids -= set(session.get("pendingOut", []))
    effective_team_ids |= set(session.get("pendingIn", []))

    if player_str in effective_team_ids:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Player already in your team")

    current_budget = Decimal(str(session["currentBudget"]))
    if current_budget < price:
        if is_multisport_league:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Insufficient budget. Stage out a player first to free funds.",
            )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient budget")

    transfers_allowed = int(session["transfersAllowed"])
    transfers_used = int(session["transfersUsed"])
    if transfers_used >= transfers_allowed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No transfers remaining")

    # Squad constraints.
    original_size = len(session["originalTeam"])
    projected_total = original_size - len(session["pendingOut"]) + len(session["pendingIn"]) + 1
    if projected_total > max_total:
        if is_multisport_league:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Adding this player would exceed squad max ({max_total}). "
                    "Stage out a player first."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Squad max {max_total} exceeded",
        )

    if is_multisport_league:
        projected_team_ids = set(session.get("originalTeam", []))
        projected_team_ids -= set(session.get("pendingOut", []))
        projected_team_ids |= set(session.get("pendingIn", []))
        projected_team_ids.add(player_str)

        projected_counts = _sport_counts_for_player_ids(db, projected_team_ids)
        incoming_player = (
            db.query(Player)
            .join(Sport, Player.sport_id == Sport.id)
            .filter(Player.id == player_id)
            .first()
        )
        incoming_sport = (
            incoming_player.sport.name.strip().lower()
            if incoming_player and incoming_player.sport and incoming_player.sport.name
            else ""
        )
        sport_cap = MULTISPORT_MAX_PLAYERS_BY_SPORT.get(incoming_sport)
        if sport_cap is not None and projected_counts.get(incoming_sport, 0) > sport_cap:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Multisport roster limit reached: max {sport_cap} {incoming_sport} players. "
                    "Stage out a player from that sport first."
                ),
            )

    if player_str not in session["pendingIn"]:
        session["pendingIn"].append(player_str)
    session["transfersUsed"] = transfers_used + 1
    session["currentBudget"] = float(current_budget - price)

    save_session(redis, user_id, session)

    return {
        "currentBudget": float(session["currentBudget"]),
        "transfersRemaining": int(session["transfersAllowed"]) - int(session["transfersUsed"]),
    }


def confirm_transfers(
    db: Session,
    redis: Redis,
    league_id: uuid.UUID,
    gameweek_id: uuid.UUID,
    current_user: User,
) -> dict[str, bool | float | int]:
    league, team = _require_league_and_team(db, league_id, current_user)
    is_multisport_league = _is_multisport_league(db, league_id)
    window_id = _current_window_id(db, league)

    user_id = str(current_user.id)
    session = get_session(redis, user_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active transfer session")
    if session.get("leagueId") != str(league_id) or session.get("gameweekId") != str(gameweek_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session does not match request league/gameweek")

    pending_out_ids = [uuid.UUID(pid) for pid in session.get("pendingOut", [])]
    pending_in_ids = [uuid.UUID(pid) for pid in session.get("pendingIn", [])]

    if not pending_out_ids and not pending_in_ids:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No staged transfers to confirm")

    if not is_multisport_league and len(pending_out_ids) != len(pending_in_ids):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pending in/out counts must match")

    for pid in pending_in_ids:
        _ensure_player_allowed_for_league_pool(db, league_id, pid)

    price_rows = (
        db.query(Player.id, Player.cost)
        .filter(Player.id.in_(pending_in_ids + pending_out_ids))
        .all()
    )
    price_map = {pid: cost for pid, cost in price_rows}

    active_rows = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    active_player_ids = {row.player_id for row in active_rows}

    for pid in pending_out_ids:
        if pid not in active_player_ids:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attempted to transfer out a non-owned player")

    final_player_ids = set(str(row.player_id) for row in active_rows)
    final_player_ids -= {str(pid) for pid in pending_out_ids}
    final_player_ids |= {str(pid) for pid in pending_in_ids}

    if is_multisport_league:
        max_total = int(_transfer_rules(db, redis, "football", league).get("max_total", 15))
        if len(final_player_ids) > max_total:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Final squad would exceed max size ({max_total}). "
                    "Stage out additional players before confirming."
                ),
            )

        final_counts_by_sport = _sport_counts_for_player_ids(db, final_player_ids)
        for sport_name, sport_cap in MULTISPORT_MAX_PLAYERS_BY_SPORT.items():
            if final_counts_by_sport.get(sport_name, 0) > sport_cap:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Final multisport roster would exceed the {sport_name} cap ({sport_cap}). "
                        "Adjust staged moves before confirming."
                    ),
                )

    refunds = Decimal("0")
    penalties_by_player_out: dict[uuid.UUID, Decimal] = {}
    refunds_by_player_out: dict[uuid.UUID, Decimal] = {}
    for row in active_rows:
        if row.player_id in set(pending_out_ids):
            refund, penalty = calculate_refund(row.cost_at_acquisition)
            refunds += refund
            penalties_by_player_out[row.player_id] = penalty
            refunds_by_player_out[row.player_id] = refund
    costs = sum((price_map.get(pid, Decimal("0")) for pid in pending_in_ids), Decimal("0"))
    new_budget = Decimal(str(session["originalBudget"])) + refunds - costs
    if new_budget < 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Final budget would be negative")

    # Atomic transaction under request-scoped session.
    for pid_out in pending_out_ids:
        row_out = (
            db.query(TeamPlayer)
            .filter(
                TeamPlayer.fantasy_team_id == team.id,
                TeamPlayer.player_id == pid_out,
                TeamPlayer.released_window_id.is_(None),
            )
            .first()
        )
        if not row_out:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Player out not available at confirm time")

        row_out.released_window_id = window_id

        db.add(
            BudgetTransaction(
                fantasy_team_id=team.id,
                player_id=pid_out,
                transfer_window_id=window_id,
                transaction_type="transfer_out_refund",
                amount=refunds_by_player_out.get(pid_out, Decimal("0")),
                penalty_applied=penalties_by_player_out.get(pid_out, Decimal("0.10")),
            )
        )

    for pid_in in pending_in_ids:
        if pid_in in active_player_ids and pid_in not in pending_out_ids:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attempted to transfer in an already-owned player")

        db.add(
            TeamPlayer(
                fantasy_team_id=team.id,
                player_id=pid_in,
                acquired_window_id=window_id,
                cost_at_acquisition=price_map.get(pid_in, Decimal("0")),
            )
        )

        db.add(
            BudgetTransaction(
                fantasy_team_id=team.id,
                player_id=pid_in,
                transfer_window_id=window_id,
                transaction_type="transfer_in_cost",
                amount=price_map.get(pid_in, Decimal("0")),
                penalty_applied=Decimal("0.00"),
            )
        )

    # Keep immutable transfer audit rows as swap pairs when possible.
    paired_count = min(len(pending_out_ids), len(pending_in_ids))
    for index in range(paired_count):
        pid_out = pending_out_ids[index]
        pid_in = pending_in_ids[index]

        db.add(
            Transfer(
                fantasy_team_id=team.id,
                transfer_window_id=window_id,
                player_out_id=pid_out,
                player_in_id=pid_in,
                cost_at_transfer=price_map.get(pid_in, Decimal("0")),
            )
        )

    team.current_budget = new_budget
    db.flush()

    # Redis sync.
    try:
        pipe = redis.pipeline(transaction=False)
        team_key = f"team:{user_id}"
        for pid in pending_out_ids:
            pipe.srem(team_key, str(pid))
        for pid in pending_in_ids:
            pipe.sadd(team_key, str(pid))
        pipe.set(f"budget:{user_id}", str(new_budget))
        price_updates = {str(pid): str(cost) for pid, cost in price_map.items()}
        if price_updates:
            pipe.hset("player:prices", mapping=price_updates)
        pipe.delete(f"session:{user_id}")
        pipe.execute()
    except Exception:
        logger.exception("Redis sync failed after confirm for user=%s", user_id)

    transfers_remaining = int(session["transfersAllowed"]) - int(session["transfersUsed"])
    return {
        "success": True,
        "newBudget": float(new_budget),
        "transfersRemaining": max(0, transfers_remaining),
    }


def cancel_session(redis: Redis, current_user: User) -> None:
    clear_session(redis, str(current_user.id))
