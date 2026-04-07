from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.auth import services
from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    GoogleLinkRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Public endpoints (no token required) ──────────────────────────────────────

@router.post("/register", response_model=RegisterResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user. Set auto_login=true to receive tokens immediately."""
    return services.register(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return services.login(db, data)


@router.post("/google", response_model=TokenResponse)
def google_auth(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    return services.google_auth(db, data)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    return services.refresh_access_token(db, data)


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=200)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return services.forgot_password(db, data.email)


@router.post("/reset-password", status_code=200)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    services.reset_password(db, data.token, data.new_password)
    return {"detail": "Password reset successful"}


# ── Protected endpoints (token required) ──────────────────────────────────────

@router.post("/logout", status_code=204, response_class=Response)
def logout(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    services.logout(db, data.refresh_token)
    return Response(status_code=204)


@router.post("/logout/all", status_code=200)
def logout_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    count = services.logout_all_devices(db, current_user.id)
    return {"detail": f"Revoked {count} active session(s)"}


@router.post("/google/link", status_code=200)
def link_google(
    data: GoogleLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    services.link_google_account(db, current_user.id, data)
    return {"detail": "Google account linked successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.post("/change-password", status_code=200)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    services.change_password(db, current_user.id, data.current_password, data.new_password)
    return {"detail": "Password changed successfully"}
