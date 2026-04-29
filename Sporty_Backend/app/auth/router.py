from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
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
from app.core.config import settings
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )


# ── Public endpoints (no token required) ──────────────────────────────────────

@router.post("/register", response_model=RegisterResponse)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new user. Set auto_login=true to receive tokens immediately."""
    result = services.register(db, data)
    if data.auto_login and isinstance(result, TokenResponse):
        _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.post("/login", status_code=200)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    tokens = services.login(db, data)
    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return {"detail": "Login successful"}


@router.post("/google", response_model=TokenResponse)
def google_auth(data: GoogleAuthRequest, response: Response, db: Session = Depends(get_db)):
    result = services.google_auth(db, data)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.post("/refresh", status_code=200)
def refresh_token(
    response: Response,
    request: Request,
    data: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db),
):
    refresh_token_value = data.refresh_token if data is not None else request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    tokens = services.refresh_access_token(db, RefreshTokenRequest(refresh_token=refresh_token_value))
    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return {"detail": "Token refreshed"}


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=200)
def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    return services.forgot_password(db, data.email, client_ip)


@router.post("/reset-password", status_code=200)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    services.reset_password(db, data.token, data.new_password)
    return {"detail": "Password reset successful"}


# ── Protected endpoints (token required) ──────────────────────────────────────

@router.post("/logout", status_code=200)
def logout(
    response: Response,
    request: Request,
    data: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    refresh_token_value = data.refresh_token if data is not None else request.cookies.get(REFRESH_TOKEN_COOKIE)
    if refresh_token_value:
        services.logout(db, refresh_token_value)
    _clear_auth_cookies(response)
    return {"detail": "Logged out"}


@router.post("/logout/all", status_code=200)
def logout_all(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    count = services.logout_all_devices(db, current_user.id)
    _clear_auth_cookies(response)
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
