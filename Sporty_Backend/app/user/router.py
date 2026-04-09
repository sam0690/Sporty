import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.user import services
from app.user.schemas import (
    UserActivityResponse,
    UserListResponse,
    UserProfileResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse, summary="List active users")
def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    items, total = services.get_users(db, page=page, page_size=page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


@router.get("/me/activity", response_model=list[UserActivityResponse], summary="Get my recent activity")
def get_my_activity(
    league_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return services.get_user_activity(db, current_user.id, league_id=league_id)


@router.get("/{user_id}", response_model=UserProfileResponse, summary="Get user profile")
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    return services.get_user(db, user_id)


@router.get("/{user_id}/activity", response_model=list[UserActivityResponse], summary="Get user profile activity")
def get_user_activity(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    return services.get_user_activity(db, user_id)


@router.patch("/{user_id}", response_model=UserProfileResponse, summary="Update user profile")
def update_user(
    user_id: uuid.UUID,
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return services.update_user(db, user_id, current_user.id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, summary="Deactivate account")
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    services.delete_user(db, user_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
