import json
import logging
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from redis import Redis
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.models import User
from app.core.config import settings
from app.league.models import (
    BudgetTransaction,
    FantasyTeam,
    League,
    LeagueSport,
    LeagueStatus,
    PointsPenalty,
    Sport,
    TeamPlayer,
    Transfer,
    TransferWindow,
)
from app.league.sportConfigs import derive_sport_type, get_squad_size
from app.player.models import Player
from app.services.budget_utils import calculate_refund
from app.services.transfer_session_service import clear_session, get_session, save_session
from app.squad.services import check_full_squad_constraints

logger = logging.getLogger(__name__)

SUPPORTED_TRANSFER_POOL_SPORTS = {"football", "basketball"}
MULTISPORT_MAX_PLAYERS_BY_SPORT: dict[str, int] = {
    "football": 8,
    "basketball": 7,
}


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
    # Budget-style transfers don't apply to draft leagues: a drafted squad has
    # unique player ownership and no per-team budget market. Draft roster moves
    # (waivers / free agents / trades) are a separate system.
    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfers are not available in draft leagues",
        )

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

    from app.league.competition_scope import ensure_player_in_league_scope

    ensure_player_in_league_scope(db, league_id, player)


def _current_window_id(db: Session, league: League) -> uuid.UUID:
    # Transfers/lineups target the next not-yet-locked gameweek (the one you're
    # setting up), not the in-progress one — its lineup deadline hasn't passed.
    from app.league.service_helpers import _league_window_competition, _window_competition_clause

    row = (
        db.query(TransferWindow.id)
        .filter(
            TransferWindow.season_id == league.season_id,
            _window_competition_clause(_league_window_competition(db, league)),
            TransferWindow.lineup_deadline_at > func.now(),
        )
        .order_by(TransferWindow.start_at.asc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No upcoming transfer window is open to edit")
    return row[0]


def _player_price(db: Session, player_id: uuid.UUID) -> Decimal:
    # Always read the live DB cost, never the `player:prices` Redis cache: that
    # cache is only rebuilt by the once-daily cache-warming job and nothing
    # invalidates it when repricing.py (or the dataset importer, or admin
    # edits) changes Player.cost in between. A player repriced down since the
    # last warm would still be checked against its old, higher cached price
    # here, producing a false "Insufficient budget" for an affordably-priced
    # player. confirm_transfers already reads Player.cost directly for the
    # same reason — this keeps both paths on the one source of truth.
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

    # Resolve platform-wide squad size from the league's sports. derive_sport_type
    # classifies from sport NAMES (not ids), so join through to Sport.name —
    # passing raw sport_ids both crashed (extra db arg) and misclassified.
    sport_names = (
        db.query(Sport.name)
        .join(LeagueSport, LeagueSport.sport_id == Sport.id)
        .filter(LeagueSport.league_id == league.id)
        .all()
    )
    sport_names_list = [row[0] for row in sport_names]
    sport_type = derive_sport_type(sport_names_list)
    squad_size = get_squad_size(sport_type)

    # DB fallback: use league-level setting and defaults.
    return {
        "transfers_per_window": int(league.transfers_per_window),
        "max_total": squad_size,
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

    # Seed the counter from already-confirmed transfers for this window, not
    # 0 — otherwise a freshly-rebuilt session (new day, new tab, TTL expiry)
    # forgets transfers already spent this window and lets the user exceed
    # transfers_per_window across multiple confirm rounds.
    #
    # Counted via BudgetTransaction("transfer_in_cost"), not the Transfer
    # audit table: confirm_transfers only writes a Transfer row per paired
    # out/in swap (min(len(pending_out), len(pending_in))), but a multisport
    # league allows unpaired in/out counts, and the session's own counter
    # increments once per stage_in call regardless of pairing. BudgetTransaction
    # is written once per incoming player unconditionally, so it's the one
    # persisted record that matches the session counter's unit exactly.
    transfers_used = (
        db.query(func.count(BudgetTransaction.id))
        .filter(
            BudgetTransaction.fantasy_team_id == team.id,
            BudgetTransaction.transfer_window_id == uuid.UUID(gameweek_id),
            BudgetTransaction.transaction_type == "transfer_in_cost",
        )
        .scalar()
    ) or 0

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
        "transfersUsed": int(transfers_used),
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
    price = _player_price(db, player_id)

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
    prospective_budget = current_budget - price
    if prospective_budget < 0:
        # Only a hard block when even paying with points can't cover it —
        # nothing at confirm time can fix an unaffordable shortfall. When it
        # IS coverable, staging proceeds (currentBudget goes negative in the
        # session) and confirm_transfers() makes the actual charge decision.
        from app.league.services import get_available_points_for_penalty

        shortfall = abs(prospective_budget)
        points_cost = (shortfall * settings.BUDGET_OVERAGE_POINTS_RATE).quantize(Decimal("0.01"))
        available_points = get_available_points_for_penalty(db, team.id)
        if points_cost > available_points:
            detail = (
                "Insufficient budget. Stage out a player first to free funds."
                if is_multisport_league else "Insufficient budget"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "insufficient_points",
                    "message": detail,
                    "points_cost": str(points_cost),
                    "available_points": str(available_points),
                },
            )

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
    session["currentBudget"] = float(prospective_budget)

    save_session(redis, user_id, session)

    points_cost_if_confirmed = (
        max(Decimal("0"), -prospective_budget) * settings.BUDGET_OVERAGE_POINTS_RATE
    ).quantize(Decimal("0.01"))

    return {
        "currentBudget": float(session["currentBudget"]),
        "transfersRemaining": int(session["transfersAllowed"]) - int(session["transfersUsed"]),
        "pointsCostIfConfirmed": float(points_cost_if_confirmed),
    }


def confirm_transfers(
    db: Session,
    redis: Redis,
    league_id: uuid.UUID,
    gameweek_id: uuid.UUID,
    current_user: User,
    *,
    pay_shortfall_with_points: bool = False,
) -> dict[str, bool | float | int | None]:
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

    # Fetch sports for incoming players to satisfy TeamPlayer snapshot
    incoming_players = (
        db.query(Player)
        .options(selectinload(Player.sport))
        .filter(Player.id.in_(pending_in_ids))
        .all()
    )
    sport_map = {p.id: p.sport.name for p in incoming_players}

    active_rows = (
        db.query(TeamPlayer)
        .options(joinedload(TeamPlayer.player).joinedload(Player.sport))
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

    # Use first sport key from session or default to football for rules lookup
    sport_name_for_rules = "football"
    if active_rows:
        sport_name_for_rules = active_rows[0].player.sport.name.strip().lower()

    max_total = int(_transfer_rules(db, redis, sport_name_for_rules, league).get("max_total", 15))
    
    if len(final_player_ids) != max_total:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Final squad must have exactly {max_total} players (got {len(final_player_ids)}).",
        )

    if is_multisport_league:
        final_counts_by_sport = _sport_counts_for_player_ids(db, final_player_ids)
        for sport_name, sport_cap in MULTISPORT_MAX_PLAYERS_BY_SPORT.items():
            if final_counts_by_sport.get(sport_name, 0) != sport_cap:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Final multisport roster must have exactly {sport_cap} {sport_name} players "
                        f"(got {final_counts_by_sport.get(sport_name, 0)})."
                    ),
                )

    # ── Max-per-club / position-minimum constraints on the final roster ──
    final_players = (
        db.query(Player)
        .filter(Player.id.in_([uuid.UUID(pid) for pid in final_player_ids]))
        .all()
    )
    sport_type = "mixed" if is_multisport_league else sport_name_for_rules
    mode = "mixed" if is_multisport_league else "single"
    violation = check_full_squad_constraints(final_players, league, sport_type, mode)
    if violation:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=violation)

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

    points_charge: Decimal | None = None
    if new_budget < 0:
        from app.league.services import get_available_points_for_penalty

        shortfall = abs(new_budget)
        points_cost = (shortfall * settings.BUDGET_OVERAGE_POINTS_RATE).quantize(Decimal("0.01"))
        available_points = get_available_points_for_penalty(db, team.id)

        if not pay_shortfall_with_points:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "insufficient_budget",
                    "message": (
                        f"Final budget would be negative by {shortfall}. Retry with "
                        "pay_shortfall_with_points=true to cover it with league points."
                    ),
                    "shortfall": str(shortfall),
                    "points_cost": str(points_cost),
                    "available_points": str(available_points),
                },
            )

        if points_cost > available_points:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "insufficient_points",
                    "message": (
                        f"Covering this shortfall costs {points_cost} points, "
                        f"but only {available_points} are available."
                    ),
                    "points_cost": str(points_cost),
                    "available_points": str(available_points),
                },
            )

        points_charge = points_cost
        new_budget = Decimal("0")

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
                league_id=league.id,
                is_draft=league.draft_mode,
                player_id=pid_in,
                sport_type=sport_map.get(pid_in),
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
    confirmed_transfers = []
    for index in range(paired_count):
        pid_out = pending_out_ids[index]
        pid_in = pending_in_ids[index]

        transfer = Transfer(
            fantasy_team_id=team.id,
            transfer_window_id=window_id,
            player_out_id=pid_out,
            player_in_id=pid_in,
            cost_at_transfer=price_map.get(pid_in, Decimal("0")),
        )
        db.add(transfer)
        confirmed_transfers.append(transfer)

    team.current_budget = new_budget
    db.flush()

    if points_charge is not None:
        db.add(PointsPenalty(
            league_id=league.id,
            fantasy_team_id=team.id,
            transfer_window_id=window_id,
            # Best-effort link — an unbalanced multisport confirm can have
            # more pending_in than paired Transfer rows (see paired_count
            # above), so there may be no single Transfer this maps to.
            transfer_id=confirmed_transfers[0].id if confirmed_transfers else None,
            points_charged=points_charge,
        ))
        db.flush()
        logger.info(
            "confirm_transfers: team=%s charged %s points for budget overage",
            team.id, points_charge,
        )

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
        "pointsCharged": float(points_charge) if points_charge is not None else None,
    }


def cancel_session(redis: Redis, current_user: User) -> None:
    clear_session(redis, str(current_user.id))
