import logging
import uuid
from datetime import datetime, timezone
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.models import User
from app.league.models import League, LeagueMembership, TransferWindow
from app.notification.models import Notification
from app.services.email_service import send_transfer_window_open_email

logger = logging.getLogger(__name__)


def _create_league_status_notifications(
    db: Session,
    league_ids: Sequence[uuid.UUID],
    message_template: str,
) -> int:
    """Create in-app notifications for all members in the provided leagues."""
    if not league_ids:
        return 0

    rows = (
        db.query(LeagueMembership.user_id, League.id, League.name)
        .join(League, League.id == LeagueMembership.league_id)
        .filter(LeagueMembership.league_id.in_(league_ids))
        .all()
    )

    if not rows:
        return 0

    notifications = [
        Notification(
            user_id=user_id,
            league_id=league_id,
            message=message_template.format(league_name=league_name),
            is_read=False,
        )
        for user_id, league_id, league_name in rows
    ]
    db.add_all(notifications)
    db.flush()
    return len(notifications)


def notify_league_active(db: Session, league_ids: Sequence[uuid.UUID]) -> int:
    """Notify league members that their league is now active."""
    return _create_league_status_notifications(
        db,
        league_ids,
        "{league_name} is now ACTIVE. Transfers and scoring are now live.",
    )


def notify_league_completed(db: Session, league_ids: Sequence[uuid.UUID]) -> int:
    """Notify league members that their league season is complete."""
    return _create_league_status_notifications(
        db,
        league_ids,
        "{league_name} is now COMPLETED. Final standings are locked.",
    )


def get_user_notifications(db: Session, user_id: uuid.UUID) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )


def mark_notification_as_read(
    db: Session,
    notification_id: uuid.UUID,
    current_user: User,
) -> Notification:
    row = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    row.is_read = True
    db.flush()
    return row


def check_and_notify_open_windows(db: Session) -> dict[str, int]:
    """Create in-app notifications and emails when transfer windows are open.

    Finds open windows where notified=False. For each league in that season,
    notifies each league member once and then marks window as notified.
    """
    now = datetime.now(timezone.utc)

    open_windows = (
        db.query(TransferWindow)
        .filter(
            TransferWindow.start_at <= now,
            TransferWindow.end_at >= now,
            TransferWindow.notified.is_(False),
        )
        .order_by(TransferWindow.start_at.asc())
        .all()
    )

    if not open_windows:
        return {"windows_checked": 0, "notifications_created": 0, "emails_sent": 0}

    notifications_created = 0
    emails_sent = 0

    for window in open_windows:
        leagues = (
            db.query(League)
            .options(joinedload(League.memberships).joinedload(LeagueMembership.user))
            .filter(League.season_id == window.season_id)
            .all()
        )

        for league in leagues:
            message = f"Transfer window #{window.number} is now open for {league.name}."
            for membership in league.memberships:
                db.add(
                    Notification(
                        user_id=membership.user_id,
                        league_id=league.id,
                        message=message,
                        is_read=False,
                    )
                )
                notifications_created += 1

                if membership.user and membership.user.email:
                    sent = send_transfer_window_open_email(
                        to_email=membership.user.email,
                        username=membership.user.username,
                        league_name=league.name,
                        start_at=window.start_at,
                        end_at=window.end_at,
                    )
                    if sent:
                        emails_sent += 1

        window.notified = True

    db.flush()
    logger.info(
        "Transfer window notifications completed: windows=%d notifications=%d emails=%d",
        len(open_windows),
        notifications_created,
        emails_sent,
    )

    return {
        "windows_checked": len(open_windows),
        "notifications_created": notifications_created,
        "emails_sent": emails_sent,
    }
