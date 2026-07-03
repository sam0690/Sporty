import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.services.storage_service import ALLOWED_AVATAR_CONTENT_TYPES, MAX_AVATAR_SIZE_BYTES, upload_avatar
from app.user import services
from app.user.schemas import (
    UserActivityResponse,
    UserListResponse,
    UserProfileResponse,
    UserPublicStatsResponse,
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


@router.get("/{user_id}/public-stats", response_model=UserPublicStatsResponse, summary="Get a user's public profile stats")
def get_user_public_stats(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Public profile stats for the target user (their leagues, points, best
    rank) — accurate for any user, unlike the viewer-scoped dashboard."""
    return services.get_user_public_stats(db, user_id)


@router.patch("/{user_id}", response_model=UserProfileResponse, summary="Update user profile")
def update_user(
    user_id: uuid.UUID,
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return services.update_user(db, user_id, current_user.id, data)


@router.post("/{user_id}/avatar", response_model=UserProfileResponse, summary="Upload profile avatar")
async def upload_user_avatar(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    file: UploadFile = File(...),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own avatar")

    if file.content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar must be JPEG, PNG, or WEBP")

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar must be smaller than 2MB")

    avatar_url = upload_avatar(user_id, file, contents)
    return services.update_user(db, user_id, current_user.id, UserUpdateRequest(avatar_url=avatar_url))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, summary="Deactivate account")
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    services.delete_user(db, user_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
