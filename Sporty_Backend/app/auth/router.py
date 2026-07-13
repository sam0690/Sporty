"""
Auth Router
───────────
Authentication endpoints with secure httpOnly cookie management.

Security design:
  - Access tokens and refresh tokens are set as httpOnly cookies
  - Tokens are NEVER exposed to JavaScript (prevents XSS token theft)
  - Refresh tokens use rotation (old token revoked on each refresh)
  - Logout revokes the refresh token server-side
  - Cookie attributes are environment-aware (secure=True in production)

Cookie configuration:
  - httpOnly: True - JavaScript cannot read the cookie
  - secure: True in production (HTTPS), False in development (HTTP)
  - sameSite: "lax" - protects against CSRF while allowing navigation
  - path: "/" - cookie sent with all requests
  - domain: Optional - set for cross-subdomain auth
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import services
from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.auth.schemas import (
    ChangePasswordRequest,
    GoogleAccountLinkRequiredResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    GoogleLinkRequest,
    GoogleLinkSuccessResponse,
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
from app.middleware.rate_limiter import get_client_ip

router = APIRouter(prefix="/auth", tags=["Auth"])

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Set authentication cookies with secure attributes.

    Security properties:
    - httpOnly=True: Prevents JavaScript access (XSS protection)
    - secure=True in production: Requires HTTPS (prevents MITM)
    - sameSite="lax": CSRF protection while allowing navigation
    - path="/": Sent with all requests to the domain

    Cookie expiration:
    - Access token: Short-lived (default 30 minutes)
    - Refresh token: Long-lived (default 7 days)

    Attributes come from Settings (previously hardcoded secure/None, which
    made COOKIE_SECURE / COOKIE_SAME_SITE dead config): production env must
    set secure=True + samesite=none (validate_production enforces this);
    development defaults to lax + insecure, which works because the Next.js
    dev server proxies /api/* so cookies are same-origin.
    """
    secure = settings.COOKIE_SECURE
    same_site = settings.COOKIE_SAME_SITE
    domain = settings.COOKIE_DOMAIN or None

    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=domain,
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
        domain=domain,
    )


def _clear_auth_cookies(response: Response) -> None:
    """
    Clear authentication cookies on logout.

    Important: Cookie deletion requires matching the exact attributes
    used when setting the cookie (path, domain, secure, samesite).
    """
    secure = settings.COOKIE_SECURE
    same_site = settings.COOKIE_SAME_SITE
    domain = settings.COOKIE_DOMAIN or None

    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        path="/",
        secure=secure,
        httponly=True,
        samesite=same_site,
        domain=domain,
    )
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE,
        path="/",
        secure=secure,
        httponly=True,
        samesite=same_site,
        domain=domain,
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
    """
    Authenticate with username/email + password.

    On success, sets httpOnly cookies for access and refresh tokens.
    The frontend should NOT read these cookies - they are sent automatically
    by the browser with subsequent requests (credentials: true).
    """
    tokens = services.login(db, data)
    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return {"detail": "Login successful"}


@router.post(
    "/google",
    response_model=TokenResponse,
    responses={409: {"model": GoogleAccountLinkRequiredResponse}},
)
def google_auth(data: GoogleAuthRequest, response: Response, db: Session = Depends(get_db)):
    """Sign in or register via Google authorization code. Sets httpOnly auth cookies."""
    result = services.google_auth(db, data)
    if isinstance(result, Response):
        return result
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.post("/refresh", status_code=200)
def refresh_token(
    response: Response,
    request: Request,
    data: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db),
):
    """
    Rotate refresh token and issue new token pair.

    The old refresh token is revoked (token rotation).
    New tokens are set as httpOnly cookies.
    Supports both cookie-based and body-based refresh token submission.
    """
    refresh_token_value = data.refresh_token if data is not None else request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    tokens = services.refresh_access_token(db, RefreshTokenRequest(refresh_token=refresh_token_value))
    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return {"detail": "Token refreshed"}


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=200)
def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Request password reset email. Rate-limited by IP + email."""
    client_ip = get_client_ip(request)
    return services.forgot_password(db, data.email, client_ip)


@router.post("/reset-password", status_code=200)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using reset token. Revokes all sessions on success."""
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
    """
    Log out from current session.

    Revokes the refresh token server-side and clears auth cookies.
    The access token remains valid until expiry, but cannot be refreshed.
    """
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
    """
    Log out from ALL devices/sessions.

    Revokes all active refresh tokens for the user.
    Useful after password change or suspected account compromise.
    """
    count = services.logout_all_devices(db, current_user.id)
    _clear_auth_cookies(response)
    return {"detail": f"Revoked {count} active session(s)"}


@router.post("/google/link", response_model=GoogleLinkSuccessResponse, status_code=200)
def link_google(
    response: Response,
    data: GoogleLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Link a Google account to the current user."""
    result = services.link_google_account(db, current_user.id, data)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user profile."""
    return current_user


@router.post("/ws-ticket", status_code=200)
def create_websocket_ticket(current_user: User = Depends(get_current_active_user)):
    """Mint a short-lived ticket for authenticated WebSocket handshakes.

    Sockets connect to the API host directly (WebSocket upgrades don't go
    through the frontend's HTTP proxy), so the httpOnly session cookie may
    not accompany the handshake. The client calls this over the normal
    authenticated channel and appends the ticket as ?token= on the socket
    URL. 5-minute TTL — it only needs to survive the connect.
    """
    from app.core.security import create_ws_ticket

    return {"token": create_ws_ticket(current_user.id)}


@router.post("/change-password", status_code=200)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Change password for current user.

    Requires current password verification.
    Revokes all sessions on success (forces re-authentication).
    """
    services.change_password(db, current_user.id, data.current_password, data.new_password)
    return {"detail": "Password changed successfully"}
