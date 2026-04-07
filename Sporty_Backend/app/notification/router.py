import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.notification.schemas import NotificationResponse
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse], summary="List my notifications")
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return notification_service.get_user_notifications(db, current_user.id)


@router.patch("/{notification_id}/read", response_model=NotificationResponse, summary="Mark notification as read")
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    row = notification_service.mark_notification_as_read(db, notification_id, current_user)
    db.commit()
    return row
