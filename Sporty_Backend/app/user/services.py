import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import User
from app.user.schemas import UserUpdateRequest


def get_users(db: Session, page: int = 1, page_size: int = 20):
    query = db.query(User).filter(User.is_active.is_(True)).order_by(User.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_user(db: Session, target_user_id: uuid.UUID, acting_user_id: uuid.UUID, data: UserUpdateRequest) -> User:
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own profile")

    user = get_user(db, target_user_id)

    if data.username and data.username != user.username:
        username_taken = db.query(User).filter(User.username == data.username, User.id != user.id).first()
        if username_taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        user.username = data.username

    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url.strip() or None

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, target_user_id: uuid.UUID, acting_user_id: uuid.UUID) -> None:
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only delete your own account")

    user = get_user(db, target_user_id)
    user.is_active = False
    db.commit()
