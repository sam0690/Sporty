import threading
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.admin.models import AdminActionType, AdminAuditLog, SystemConfig
from app.admin.audit import record_admin_action
from app.auth import services as auth_services
from app.auth.models import User, UserRole
from app.league import services as league_service
from app.league.models import (
    BudgetTransaction,
    FantasyTeam,
    League,
    LeagueStatus,
    Season,
    Sport,
    TeamPlayer,
    TradeOffer,
    Transfer,
    TransferWindow,
    WaiverClaim,
)
from app.player.models import Player
from app.services import trade_service
from app.services.pricing.repricing import recalculate_player_prices
from app.services.scoring.engine import score_active_transfer_windows, score_transfer_window_for_league
from app.support import services as support_services
from app.support.models import SupportTicket, TicketMessage, TicketStatus
from app.user import services as user_services


# ── Audit log ───────────────────────────────────────────────────────────────────

def list_audit_log(db: Session, page: int, page_size: int) -> tuple[list[AdminAuditLog], int]:
    query = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


# ── Users ───────────────────────────────────────────────────────────────────────

def list_users_admin(
    db: Session,
    page: int,
    page_size: int,
    search: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    """Unlike user.services.get_users (active-only), this surfaces every
    user regardless of status — an admin needs to find suspended accounts."""
    query = db.query(User)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (User.username.ilike(like)) | (User.email.ilike(like))
        )
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))
    query = query.order_by(User.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_user_admin(db: Session, user_id: uuid.UUID) -> User:
    """Unlike user.services.get_user, does not filter on is_active — an
    admin must be able to look up suspended accounts too."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def suspend_user(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    reason: str | None = None,
) -> User:
    user_services.delete_user(db, target_user_id, actor.id, admin_override=True)
    auth_services.logout_all_devices(db, target_user_id)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_SUSPEND,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
    )
    db.commit()
    return get_user_admin(db, target_user_id)


def reactivate_user(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    reason: str | None = None,
) -> User:
    user = get_user_admin(db, target_user_id)
    user.is_active = True
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_REACTIVATE,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
    )
    db.commit()
    db.refresh(user)
    return user


def force_logout_user(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    reason: str | None = None,
) -> int:
    get_user_admin(db, target_user_id)  # 404 if the user doesn't exist
    revoked_count = auth_services.logout_all_devices(db, target_user_id)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_FORCE_LOGOUT,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
        metadata={"revoked_count": revoked_count},
    )
    db.commit()
    return revoked_count


def change_user_role(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    new_role: UserRole,
    reason: str | None = None,
) -> User:
    if target_user_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role",
        )

    user = get_user_admin(db, target_user_id)
    old_role = user.role

    if old_role == UserRole.SUPER_ADMIN and new_role != UserRole.SUPER_ADMIN:
        remaining = (
            db.query(User)
            .filter(User.role == UserRole.SUPER_ADMIN, User.id != user.id)
            .count()
        )
        if remaining == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot demote the last remaining super admin",
            )

    user.role = new_role
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_ROLE_CHANGE,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
        metadata={"old_role": old_role.value, "new_role": new_role.value},
    )
    db.commit()
    db.refresh(user)
    return user


# ── Leagues ─────────────────────────────────────────────────────────────────────

def list_leagues_admin(
    db: Session,
    page: int,
    page_size: int,
    search: str | None = None,
    status_filter: LeagueStatus | None = None,
) -> tuple[list[tuple[League, str]], int]:
    """Platform-wide league listing (no ownership/membership scoping).
    Returns (league, owner_username) pairs."""
    query = db.query(League, User.username).join(User, User.id == League.owner_id)
    if search:
        query = query.filter(League.name.ilike(f"%{search}%"))
    if status_filter is not None:
        query = query.filter(League.status == status_filter)
    query = query.order_by(League.created_at.desc())

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return rows, total


def override_league_status(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    new_status: LeagueStatus,
    reason: str | None = None,
) -> League:
    league = league_service.update_league_status(db, league_id, new_status, actor, admin_override=True)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.LEAGUE_STATUS_OVERRIDE,
        target_type="league",
        target_id=league_id,
        reason=reason,
        metadata={"new_status": new_status.value},
    )
    db.commit()
    return league


def override_delete_league(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    reason: str | None = None,
) -> None:
    league_service.delete_league(db, league_id, actor, admin_override=True)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.LEAGUE_DELETE_OVERRIDE,
        target_type="league",
        target_id=league_id,
        reason=reason,
    )
    db.commit()


def override_league_settings(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    name: str | None = None,
    is_public: bool | None = None,
    reason: str | None = None,
) -> League:
    league = league_service.update_league_settings(db, league_id, name=name, is_public=is_public)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.LEAGUE_SETTINGS_OVERRIDE,
        target_type="league",
        target_id=league_id,
        reason=reason,
        metadata={"name": name, "is_public": is_public},
    )
    db.commit()
    return league


# ── Seasons ─────────────────────────────────────────────────────────────────────
#
# Season rows (app/league/models.py Season) are the real-world date range a
# League runs in (e.g. "2026/27"). There's no user-facing way to create one —
# until now this was seed-script/CLI only (scripts/seed_season_and_windows.py),
# which meant league renewal (renew_league) had nothing to point at once a
# year's Season passed. This is the minimal admin surface to keep pace with
# the real-world calendar without shell access.

def list_seasons_admin(db: Session) -> list[Season]:
    return db.query(Season).order_by(Season.sport_id, Season.start_date.desc()).all()


def create_season_admin(
    db: Session,
    actor: User,
    sport_id: uuid.UUID,
    name: str,
    start_date,
    end_date,
    reason: str | None = None,
) -> Season:
    sport = db.query(Sport).filter(Sport.id == sport_id).first()
    if not sport:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sport not found")

    if end_date <= start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be after start_date",
        )

    season = Season(sport_id=sport_id, name=name, start_date=start_date, end_date=end_date)
    db.add(season)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A season with this name, start date, or overlapping date range already exists for this sport",
        )

    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.SEASON_CREATE,
        target_type="season",
        target_id=season.id,
        reason=reason,
        metadata={"sport_id": str(sport_id), "name": name},
    )
    db.commit()
    return season


# ── Scoring ─────────────────────────────────────────────────────────────────────

def recalculate_window_score(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
    reason: str | None = None,
) -> dict:
    result = score_transfer_window_for_league(
        db, league_id=league_id, transfer_window_id=transfer_window_id
    )
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.SCORING_RECALCULATE,
        target_type="transfer_window",
        target_id=transfer_window_id,
        reason=reason,
        metadata={"league_id": str(league_id), **result},
    )
    db.commit()
    return result


def recalculate_active_windows(db: Session, actor: User, reason: str | None = None) -> dict:
    result = score_active_transfer_windows(db, commit=False)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.SCORING_RECALCULATE,
        target_type="platform",
        target_id="active_windows",
        reason=reason,
        metadata=result,
    )
    db.commit()
    return result


def _require_transfer_window(db: Session, window_id: uuid.UUID) -> TransferWindow:
    window = db.query(TransferWindow).filter(TransferWindow.id == window_id).first()
    if not window:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer window not found")
    return window


def set_window_lock(
    db: Session,
    actor: User,
    window_id: uuid.UUID,
    *,
    transfers_locked: bool | None = None,
    lineup_locked: bool | None = None,
    reason: str | None = None,
) -> TransferWindow:
    """Force-set a transfer window's lock flags — the same fields the
    auto-lock Celery tasks (app/services/transfer_window_service.py) flip
    once their respective deadlines pass."""
    window = _require_transfer_window(db, window_id)
    if transfers_locked is not None:
        window.transfers_locked = transfers_locked
    if lineup_locked is not None:
        window.lineup_locked = lineup_locked

    action = AdminActionType.SCORING_WINDOW_LOCK if (transfers_locked or lineup_locked) else AdminActionType.SCORING_WINDOW_UNLOCK
    record_admin_action(
        db,
        actor=actor,
        action=action,
        target_type="transfer_window",
        target_id=window_id,
        reason=reason,
        metadata={"transfers_locked": transfers_locked, "lineup_locked": lineup_locked},
    )
    db.commit()
    db.refresh(window)
    return window


# ── Players / pricing ───────────────────────────────────────────────────────────

def get_player_admin(db: Session, player_id: uuid.UUID) -> Player:
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return player


def edit_player(
    db: Session,
    actor: User,
    player_id: uuid.UUID,
    *,
    name: str | None = None,
    position: str | None = None,
    cost: float | None = None,
    is_available: bool | None = None,
    photo_url: str | None = None,
    reason: str | None = None,
) -> Player:
    player = get_player_admin(db, player_id)
    before = {
        "name": player.name,
        "position": player.position,
        "cost": float(player.cost),
        "is_available": player.is_available,
    }

    if name is not None:
        player.name = name
    if position is not None:
        player.position = position
    if cost is not None:
        player.cost = Decimal(str(cost))
    if is_available is not None:
        player.is_available = is_available
    if photo_url is not None:
        player.photo_url = photo_url

    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.PLAYER_DATA_EDIT,
        target_type="player",
        target_id=player_id,
        reason=reason,
        metadata={"before": before},
    )
    db.commit()
    db.refresh(player)
    return player


def trigger_repricing(
    db: Session,
    actor: User,
    lookback_windows: int = 3,
    reason: str | None = None,
) -> dict:
    result = recalculate_player_prices(db, lookback_windows=lookback_windows)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.PLAYER_PRICE_OVERRIDE,
        target_type="platform",
        target_id="repricing",
        reason=reason,
        metadata=result,
    )
    db.commit()
    return result


# ── Transactions (trades / waivers / transfers) ─────────────────────────────────

def admin_veto_trade(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    trade_id: uuid.UUID,
    reason: str | None = None,
) -> dict:
    result = trade_service.veto_trade(db, league_id, trade_id, actor, admin_override=True)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.TRADE_VETO_OVERRIDE,
        target_type="trade",
        target_id=trade_id,
        reason=reason,
        metadata={"league_id": str(league_id)},
    )
    db.commit()
    return result


def admin_cancel_trade(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    trade_id: uuid.UUID,
    reason: str | None = None,
) -> dict:
    """Force-cancel a trade regardless of which team proposed it — unlike
    trade_service.cancel_trade, this doesn't require the actor to own a
    team in the league (admins generally don't)."""
    offer = trade_service._get_offer(db, league_id, trade_id)
    if offer.status not in ("proposed", "accepted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Trade is {offer.status}",
        )
    offer.status = "cancelled"
    db.flush()
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.TRADE_CANCEL_OVERRIDE,
        target_type="trade",
        target_id=trade_id,
        reason=reason,
        metadata={"league_id": str(league_id)},
    )
    db.commit()
    return {"id": str(offer.id), "status": "cancelled"}


def admin_cancel_waiver_claim(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    claim_id: uuid.UUID,
    reason: str | None = None,
) -> dict:
    """Force-cancel any pending waiver claim — unlike
    waiver_service.cancel_claim, this doesn't require the actor to own the
    claiming team (admins generally don't)."""
    claim = (
        db.query(WaiverClaim)
        .filter(WaiverClaim.id == claim_id, WaiverClaim.league_id == league_id)
        .first()
    )
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waiver claim not found")
    if claim.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending claims can be cancelled",
        )
    claim.status = "cancelled"
    db.flush()
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.WAIVER_OVERRIDE,
        target_type="waiver_claim",
        target_id=claim_id,
        reason=reason,
        metadata={"league_id": str(league_id)},
    )
    db.commit()
    return {"id": str(claim.id), "status": "cancelled"}


def admin_reverse_transfer(
    db: Session,
    actor: User,
    transfer_id: uuid.UUID,
    reason: str | None = None,
) -> Transfer:
    """Undo a budget-mode transfer as a compensating entry: un-release the
    player who went out, release the player who came in, and reverse the
    exact budget delta this transfer applied — never mutating the original
    Transfer/BudgetTransaction rows (immutable ledger).

    Conservative by design: only reverses cleanly if the roster hasn't
    moved on since (player_in still active, player_out not re-acquired).
    """
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    if transfer.reversed_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer already reversed")

    team = db.query(FantasyTeam).filter(FantasyTeam.id == transfer.fantasy_team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    released_row = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.player_id == transfer.player_out_id,
            TeamPlayer.released_window_id == transfer.transfer_window_id,
        )
        .first()
    )
    acquired_row = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.player_id == transfer.player_in_id,
            TeamPlayer.acquired_window_id == transfer.transfer_window_id,
        )
        .first()
    )
    if not released_row or not acquired_row:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roster rows for this transfer no longer exist",
        )
    if acquired_row.released_window_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Player brought in has since been transferred away — cannot cleanly reverse",
        )
    already_reacquired = (
        db.query(TeamPlayer)
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.player_id == transfer.player_out_id,
            TeamPlayer.released_window_id.is_(None),
        )
        .first()
    )
    if already_reacquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Player transferred out has since been re-acquired — cannot cleanly reverse",
        )

    refund_txn = (
        db.query(BudgetTransaction)
        .filter(
            BudgetTransaction.fantasy_team_id == team.id,
            BudgetTransaction.player_id == transfer.player_out_id,
            BudgetTransaction.transfer_window_id == transfer.transfer_window_id,
            BudgetTransaction.transaction_type == "transfer_out_refund",
        )
        .order_by(BudgetTransaction.created_at.desc())
        .first()
    )
    cost_txn = (
        db.query(BudgetTransaction)
        .filter(
            BudgetTransaction.fantasy_team_id == team.id,
            BudgetTransaction.player_id == transfer.player_in_id,
            BudgetTransaction.transfer_window_id == transfer.transfer_window_id,
            BudgetTransaction.transaction_type == "transfer_in_cost",
        )
        .order_by(BudgetTransaction.created_at.desc())
        .first()
    )
    refund_amount = refund_txn.amount if refund_txn else Decimal("0")
    cost_amount = cost_txn.amount if cost_txn else transfer.cost_at_transfer

    old_budget = team.current_budget
    new_budget = old_budget + cost_amount - refund_amount
    if new_budget < 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reversal would result in negative budget")

    released_row.released_window_id = None
    acquired_row.released_window_id = transfer.transfer_window_id
    team.current_budget = new_budget

    # BudgetTransaction.transaction_type is DB-constrained to a closed set
    # (ck_budget_tx_type_allowed) and amount must be non-negative
    # (ck_budget_tx_amount_non_negative) — reuse the existing type values
    # with their established sign convention (transfer_out_refund credits
    # the budget, transfer_in_cost debits it) rather than adding new types.
    # The admin_audit_logs entry below is what actually identifies these
    # rows as a reversal, not the transaction_type.
    db.add(
        BudgetTransaction(
            fantasy_team_id=team.id,
            player_id=transfer.player_in_id,
            transfer_window_id=transfer.transfer_window_id,
            transaction_type="transfer_out_refund",
            amount=cost_amount,
            penalty_applied=Decimal("0.00"),
        )
    )
    db.add(
        BudgetTransaction(
            fantasy_team_id=team.id,
            player_id=transfer.player_out_id,
            transfer_window_id=transfer.transfer_window_id,
            transaction_type="transfer_in_cost",
            amount=refund_amount,
            penalty_applied=Decimal("0.00"),
        )
    )

    transfer.reversed_at = datetime.now(timezone.utc)
    db.flush()

    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.TRANSFER_REVERSE,
        target_type="transfer",
        target_id=transfer_id,
        reason=reason,
        metadata={
            "team_id": str(team.id),
            "player_out_id": str(transfer.player_out_id),
            "player_in_id": str(transfer.player_in_id),
            "old_budget": str(old_budget),
            "new_budget": str(new_budget),
        },
    )
    db.commit()
    db.refresh(transfer)
    return transfer


# ── Job visibility ───────────────────────────────────────────────────────────────

_GLOBAL_LOCK_KEYS = [
    "lock:score:active_windows",
    "lock:live:football:poll",
    "lock:live:nba:poll",
    "lock:live:cricket:poll",
]


def get_celery_jobs_status() -> dict:
    from app.core.celery_app import celery_app
    from app.core.redis import get_redis
    from app.tasks.celery_schedule import CELERY_BEAT_SCHEDULE

    beat_schedule = [
        {"name": name, "task": entry["task"], "schedule": str(entry["schedule"])}
        for name, entry in CELERY_BEAT_SCHEDULE.items()
    ]

    def _flatten(by_worker: dict | None) -> list[dict]:
        items: list[dict] = []
        for worker, tasks in (by_worker or {}).items():
            for t in tasks:
                items.append({
                    "worker": worker,
                    "task": t.get("name") or (t.get("request") or {}).get("name"),
                    "id": t.get("id"),
                })
        return items

    active: dict | None = None
    scheduled: dict | None = None
    reserved: dict | None = None
    inspect_reachable = True

    # inspect(timeout=2) bounds the reply-collection wait, but not the
    # initial broker connection/handshake — over a remote TLS Redis with no
    # worker listening, that alone can take far longer than 2s. Run it on a
    # daemon thread with a hard join deadline so a quiet broker degrades the
    # dashboard instead of hanging the request for 30+ seconds; if the thread
    # is still running when the deadline passes, we just stop waiting on it
    # (it finishes on its own and gets discarded — nothing to cancel).
    result: dict = {}

    def _run_inspect() -> None:
        try:
            inspect = celery_app.control.inspect(timeout=2)
            result["active"] = inspect.active()
            result["scheduled"] = inspect.scheduled()
            result["reserved"] = inspect.reserved()
        except Exception:
            pass

    thread = threading.Thread(target=_run_inspect, daemon=True)
    thread.start()
    thread.join(timeout=5)

    if thread.is_alive() or "active" not in result:
        inspect_reachable = False
    else:
        active = result.get("active")
        scheduled = result.get("scheduled")
        reserved = result.get("reserved")

    locks_held: list[str] = []
    try:
        redis = get_redis()
        for key in _GLOBAL_LOCK_KEYS:
            if redis.exists(key):
                locks_held.append(key)
    except Exception:
        pass

    return {
        "workers_online": list((active or {}).keys()),
        "active": _flatten(active),
        "scheduled": _flatten(scheduled),
        "reserved": _flatten(reserved),
        "beat_schedule": beat_schedule,
        "locks_held": locks_held,
        "inspect_reachable": inspect_reachable,
    }


def get_kafka_jobs_status() -> dict:
    from app.core.redis import get_redis
    from app.core.worker_heartbeat import HEARTBEAT_TTL_SECONDS, heartbeat_key

    worker_names = ["normalizer", "points-engine", "notifications"]
    workers: list[dict] = []
    try:
        redis = get_redis()
        for name in worker_names:
            ttl = redis.ttl(heartbeat_key(name))
            alive = ttl is not None and ttl > 0
            workers.append({
                "name": name,
                "alive": alive,
                "last_seen_seconds_ago": (HEARTBEAT_TTL_SECONDS - ttl) if alive else None,
            })
    except Exception:
        workers = [{"name": name, "alive": False, "last_seen_seconds_ago": None} for name in worker_names]

    return {"workers": workers}


# ── System config / feature flags ────────────────────────────────────────────────

def list_system_config(db: Session) -> list[SystemConfig]:
    return db.query(SystemConfig).order_by(SystemConfig.key).all()


def _upsert_system_config(
    db: Session,
    actor: User,
    key: str,
    value: dict,
    description: str | None = None,
) -> SystemConfig:
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if row:
        row.value = value
        row.updated_by_user_id = actor.id
    else:
        row = SystemConfig(key=key, value=value, description=description, updated_by_user_id=actor.id)
        db.add(row)
    return row


def toggle_realtime_pipeline(db: Session, actor: User, enabled: bool, reason: str | None = None) -> SystemConfig:
    """Writes SystemConfig only — the Kafka producer/MatchScheduler are wired
    at app/main.py's lifespan startup, so this has no live effect on the
    current process. It sets the value the NEXT process start will read via
    get_effective_flag (once main.py's startup block is updated to check it)."""
    row = _upsert_system_config(
        db, actor, "realtime_pipeline_enabled", {"enabled": enabled},
        description="Kafka realtime pipeline — restart required to take effect (wired at process startup)",
    )
    record_admin_action(
        db, actor=actor, action=AdminActionType.FEATURE_FLAG_TOGGLE,
        target_type="system_config", target_id="realtime_pipeline_enabled",
        reason=reason, metadata={"enabled": enabled},
    )
    db.commit()
    db.refresh(row)
    return row


def toggle_live_polling(db: Session, actor: User, enabled: bool, reason: str | None = None) -> SystemConfig:
    """Takes effect on the next football/NBA live-sync task run —
    get_effective_flag is already wired into both sync functions."""
    row = _upsert_system_config(
        db, actor, "live_polling_enabled", {"enabled": enabled},
        description="Live external-API polling for football/NBA (takes effect on next poll run)",
    )
    record_admin_action(
        db, actor=actor, action=AdminActionType.FEATURE_FLAG_TOGGLE,
        target_type="system_config", target_id="live_polling_enabled",
        reason=reason, metadata={"enabled": enabled},
    )
    db.commit()
    db.refresh(row)
    return row


# ── Support tickets ───────────────────────────────────────────────────────────────

def list_tickets_admin(
    db: Session,
    page: int,
    page_size: int,
    status_filter: TicketStatus | None = None,
    assigned_admin_user_id: uuid.UUID | None = None,
) -> tuple[list[tuple[SupportTicket, str, str | None]], int]:
    from sqlalchemy.orm import aliased

    AssignedUser = aliased(User)
    query = (
        db.query(SupportTicket, User.username, AssignedUser.username)
        .join(User, User.id == SupportTicket.reporter_user_id)
        .outerjoin(AssignedUser, AssignedUser.id == SupportTicket.assigned_admin_user_id)
    )
    if status_filter is not None:
        query = query.filter(SupportTicket.status == status_filter)
    if assigned_admin_user_id is not None:
        query = query.filter(SupportTicket.assigned_admin_user_id == assigned_admin_user_id)
    query = query.order_by(SupportTicket.created_at.desc())

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return rows, total


def get_ticket_admin(db: Session, ticket_id: uuid.UUID) -> SupportTicket:
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


def _ticket_usernames(db: Session, ticket: SupportTicket) -> tuple[str, str | None]:
    reporter = db.query(User).filter(User.id == ticket.reporter_user_id).first()
    assignee = (
        db.query(User).filter(User.id == ticket.assigned_admin_user_id).first()
        if ticket.assigned_admin_user_id
        else None
    )
    return (reporter.username if reporter else ""), (assignee.username if assignee else None)


def update_ticket_admin(
    db: Session,
    actor: User,
    ticket_id: uuid.UUID,
    *,
    new_status: TicketStatus | None = None,
    priority=None,
    assigned_admin_user_id: uuid.UUID | None = None,
    reason: str | None = None,
) -> SupportTicket:
    ticket = get_ticket_admin(db, ticket_id)
    before = {
        "status": ticket.status.value,
        "priority": ticket.priority.value,
        "assigned_admin_user_id": str(ticket.assigned_admin_user_id) if ticket.assigned_admin_user_id else None,
    }

    action = AdminActionType.TICKET_UPDATE
    if new_status is not None:
        ticket.status = new_status
        if new_status == TicketStatus.RESOLVED and ticket.resolved_at is None:
            ticket.resolved_at = datetime.now(timezone.utc)
            action = AdminActionType.TICKET_RESOLVE
    if priority is not None:
        ticket.priority = priority
    if assigned_admin_user_id is not None:
        ticket.assigned_admin_user_id = assigned_admin_user_id
        if new_status is None:
            action = AdminActionType.TICKET_ASSIGN

    record_admin_action(
        db, actor=actor, action=action, target_type="ticket", target_id=ticket_id,
        reason=reason, metadata={"before": before},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


def add_ticket_message_admin(
    db: Session,
    actor: User,
    ticket_id: uuid.UUID,
    body: str,
    *,
    is_internal_note: bool = False,
) -> TicketMessage:
    get_ticket_admin(db, ticket_id)  # 404s if missing
    message = support_services.add_message(db, ticket_id, actor, body, is_internal_note=is_internal_note)
    record_admin_action(
        db, actor=actor, action=AdminActionType.TICKET_UPDATE, target_type="ticket", target_id=ticket_id,
        metadata={"message": True, "internal": is_internal_note},
    )
    db.commit()
    db.refresh(message)
    return message


# ── Browse endpoints for the Scoring/Transactions pickers ──────────────────────

def list_transfer_windows_for_league(db: Session, league_id: uuid.UUID) -> list[TransferWindow]:
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    return (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id)
        .order_by(TransferWindow.number.asc())
        .all()
    )


def list_trades_for_league(
    db: Session, league_id: uuid.UUID, *, only_actionable: bool = True
) -> list[dict]:
    FromTeam = FantasyTeam
    query = (
        db.query(TradeOffer, FromTeam.name)
        .join(FromTeam, FromTeam.id == TradeOffer.from_team_id)
        .filter(TradeOffer.league_id == league_id)
    )
    if only_actionable:
        query = query.filter(TradeOffer.status.in_(["proposed", "accepted"]))
    rows = query.order_by(TradeOffer.created_at.desc()).all()

    to_team_ids = {offer.to_team_id for offer, _ in rows}
    to_team_names = {
        t.id: t.name for t in db.query(FantasyTeam).filter(FantasyTeam.id.in_(to_team_ids))
    } if to_team_ids else {}

    return [
        {
            "id": offer.id,
            "from_team_name": from_name,
            "to_team_name": to_team_names.get(offer.to_team_id, ""),
            "status": offer.status,
            "offered_count": len(offer.offered_player_ids or []),
            "requested_count": len(offer.requested_player_ids or []),
            "created_at": offer.created_at,
        }
        for offer, from_name in rows
    ]


def list_waiver_claims_for_league(
    db: Session, league_id: uuid.UUID, *, only_pending: bool = True
) -> list[dict]:
    from sqlalchemy.orm import aliased

    AddPlayer = aliased(Player)
    DropPlayer = aliased(Player)
    query = (
        db.query(WaiverClaim, FantasyTeam.name, AddPlayer.name, DropPlayer.name)
        .join(FantasyTeam, FantasyTeam.id == WaiverClaim.fantasy_team_id)
        .join(AddPlayer, AddPlayer.id == WaiverClaim.add_player_id)
        .join(DropPlayer, DropPlayer.id == WaiverClaim.drop_player_id)
        .filter(WaiverClaim.league_id == league_id)
    )
    if only_pending:
        query = query.filter(WaiverClaim.status == "pending")
    rows = query.order_by(WaiverClaim.created_at.desc()).all()

    return [
        {
            "id": claim.id,
            "team_name": team_name,
            "add_player_name": add_name,
            "drop_player_name": drop_name,
            "status": claim.status,
            "claim_priority": claim.claim_priority,
            "created_at": claim.created_at,
        }
        for claim, team_name, add_name, drop_name in rows
    ]


def list_transfers_for_league(
    db: Session, league_id: uuid.UUID, *, only_reversible: bool = False
) -> list[dict]:
    from sqlalchemy.orm import aliased

    OutPlayer = aliased(Player)
    InPlayer = aliased(Player)
    query = (
        db.query(Transfer, FantasyTeam.name, OutPlayer.name, InPlayer.name)
        .join(FantasyTeam, FantasyTeam.id == Transfer.fantasy_team_id)
        .join(OutPlayer, OutPlayer.id == Transfer.player_out_id)
        .join(InPlayer, InPlayer.id == Transfer.player_in_id)
        .filter(FantasyTeam.league_id == league_id)
    )
    if only_reversible:
        query = query.filter(Transfer.reversed_at.is_(None))
    rows = query.order_by(Transfer.created_at.desc()).limit(100).all()

    return [
        {
            "id": transfer.id,
            "team_name": team_name,
            "player_out_name": out_name,
            "player_in_name": in_name,
            "cost_at_transfer": float(transfer.cost_at_transfer),
            "reversed_at": transfer.reversed_at,
            "created_at": transfer.created_at,
        }
        for transfer, team_name, out_name, in_name in rows
    ]
