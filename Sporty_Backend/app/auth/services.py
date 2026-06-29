import uuid
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from sqlalchemy import or_
from sqlalchemy.orm import Session
import requests

from app.auth.models import AuthProvider, RefreshToken, User
from app.auth.schemas import (
    GoogleAccountLinkRequiredResponse,
    GoogleAuthRequest,
    GoogleLinkRequest,
    GoogleLinkSuccessResponse,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.core.security import (
    create_password_reset_token,
    create_access_token,
    decode_password_reset_token,
    hash_password,
    verify_google_id_token,
    verify_password,
)
from app.core.config import settings
from app.core.redis import get_redis
from app.services.email_service import send_password_reset_email

logger = logging.getLogger(__name__)
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_LINK_TOKEN_EXPIRE_MINUTES = 15
GOOGLE_LINK_TOKEN_TYPE = "google_link"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_tokens(db: Session, user: User) -> TokenResponse:
    """
    Create token pair and stage the refresh token — does NOT commit.
    Caller is responsible for committing.
    This keeps _build_tokens composable inside larger transactions.
    """
    access_token = create_access_token(user_id=user.id)
    db_token, raw_refresh = RefreshToken.create_for_user(user.id)
    db.add(db_token)

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


def _generate_unique_username(db: Session, base: str) -> str:
    """
    Generate a unique username from a base string (e.g. email prefix).
    Appends a random suffix if the base is already taken.
    """
    if not db.query(User).filter(User.username == base).first():
        return base
    # Collision — append random hex suffix
    for _ in range(10):
        candidate = f"{base}_{uuid.uuid4().hex[:6]}"
        if not db.query(User).filter(User.username == candidate).first():
            return candidate
    # Fallback: full UUID (virtually impossible to reach)
    return f"{base}_{uuid.uuid4().hex}"


def _hash_password_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _exchange_google_authorization_code(code: str) -> str:
    """Exchange a Google authorization code for an ID token."""
    if not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth client secret is not configured",
        )

    try:
        response = requests.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
    except requests.RequestException:
        logger.exception("Google authorization code exchange failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google authorization code",
        )

    if response.status_code != 200:
        logger.warning(
            "Google token exchange failed: status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google authorization code",
        )

    token_data = response.json()
    id_token = token_data.get("id_token")
    if not isinstance(id_token, str) or not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token exchange did not return an ID token",
        )

    return id_token


def _create_google_link_token(*, sub: str, email: str, name: str | None, picture: str | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "type": GOOGLE_LINK_TOKEN_TYPE,
        "sub": sub,
        "email": email,
        "name": name,
        "picture": picture,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=GOOGLE_LINK_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode_google_link_token(token: str) -> dict[str, str | None]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google link token",
        )

    if payload.get("type") != GOOGLE_LINK_TOKEN_TYPE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google link token",
        )

    email = payload.get("email")
    sub = payload.get("sub")
    if not isinstance(email, str) or not email or not isinstance(sub, str) or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google link token",
        )

    return {
        "sub": sub,
        "email": email,
        "name": payload.get("name") if isinstance(payload.get("name"), str) else None,
        "picture": payload.get("picture") if isinstance(payload.get("picture"), str) else None,
    }


def _is_forgot_password_rate_limited(client_ip: str, email: str) -> bool:
    """Return True when forgot-password traffic exceeds configured limits."""
    try:
        redis = get_redis()
        key_material = f"{client_ip}:{email.strip().lower()}"
        key_hash = hashlib.sha256(key_material.encode()).hexdigest()
        key = f"auth:forgot-password:rl:{key_hash}"

        current = redis.incr(key)
        if current == 1:
            redis.expire(key, settings.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS)

        return current > settings.FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS
    except Exception:
        # Fail open if Redis is unavailable; do not block legitimate resets.
        return False


# ── Public service functions ──────────────────────────────────────────────────

def register(db: Session, data: RegisterRequest):
    """
    Create a new user with email/password.
    
    Returns:
        - If auto_login=True: TokenResponse (access_token, refresh_token, token_type)
        - If auto_login=False: UserResponse (user object only)
    """

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        username=data.username,
        email=data.email,
        auth_provider=AuthProvider.LOCAL,
        password_hash=hash_password(data.password),
        is_active=True,
    )
    db.add(user)
    db.flush()  # assign user.id so we can reference it
    
    if data.auto_login:
        # Auto-login: return tokens
        response = _build_tokens(db, user)
        db.commit()
        return response
    else:
        # No auto-login: return user object only
        db.commit()
        db.refresh(user)
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "auth_provider": user.auth_provider.value,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }


def login(db: Session, data: LoginRequest) -> TokenResponse:
    """Authenticate with a username or email + password and return tokens."""

    identifier = data.identifier.strip()
    normalized_identifier = identifier.lower()
    user = (
        db.query(User)
        .filter(or_(User.email == normalized_identifier, User.username == identifier))
        .first()
    )
    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    response = _build_tokens(db, user)
    db.commit()
    return response


def google_auth(db: Session, data: GoogleAuthRequest) -> TokenResponse | JSONResponse:
    """Sign in (or register) via a Google authorization code from the frontend."""

    id_token = _exchange_google_authorization_code(data.code)
    payload = verify_google_id_token(id_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    google_id = payload.sub
    email = payload.email
    avatar_url = payload.picture

    # 1. Try to find an existing user by google_id
    user = db.query(User).filter(User.google_id == google_id).first()

    if not user:
        # 2. Try to find by email (maybe they registered with password first)
        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.auth_provider == AuthProvider.GOOGLE:
                user.google_id = google_id
                if avatar_url:
                    user.avatar_url = avatar_url
                response = _build_tokens(db, user)
                db.commit()
                return response

            link_token = _create_google_link_token(
                sub=google_id,
                email=email,
                name=payload.name,
                picture=avatar_url,
            )
            payload = GoogleAccountLinkRequiredResponse(
                message="Account exists with different login method",
                email=email,
                googleLinkToken=link_token,
            )
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=payload.model_dump(),
            )
        else:
            # 3. Brand-new Google user → create account (no password)
            user = User(
                username=_generate_unique_username(db, email.split("@")[0]),
                email=email,
                auth_provider=AuthProvider.GOOGLE,
                google_id=google_id,
                avatar_url=avatar_url,
                is_active=True,
            )
            db.add(user)
            db.flush()  # assign user.id and persist defaults before token creation

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    response = _build_tokens(db, user)
    db.commit()
    return response


def refresh_access_token(db: Session, data: RefreshTokenRequest) -> TokenResponse:
    """
    Issue a new access + refresh token pair (token rotation).
    The old refresh token is revoked.
    Refresh tokens are opaque — looked up by hash, not decoded.
    """
    # Look up by hash — we never store the raw token
    token_hash = RefreshToken.hash_token(data.refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .first()
    )
    if not stored or not stored.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    # Revoke the old token
    stored.revoked_at = datetime.now(timezone.utc)

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or disabled")

    response = _build_tokens(db, user)
    db.commit()
    return response


def logout(db: Session, refresh_token: str) -> None:
    """Revoke a refresh token (log out)."""
    token_hash = RefreshToken.hash_token(refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .first()
    )
    if stored:
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()


def logout_all_devices(db: Session, user_id: uuid.UUID) -> int:
    """Revoke all active refresh tokens for a user. Returns count revoked."""
    now = datetime.now(timezone.utc)
    count = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .update({"revoked_at": now})
    )
    db.commit()
    return count


def link_google_account(
    db: Session,
    user_id: uuid.UUID,
    data: GoogleLinkRequest,
) -> GoogleLinkSuccessResponse:
    """
    Link a Google account to an existing (logged-in) user.
    The authenticated session is the proof of ownership; the Google
    email must match the current account exactly.
    """
    payload = _decode_google_link_token(data.link_token)
    google_id = payload["sub"]
    email = payload["email"]

    # Make sure this Google account isn't already linked to someone else
    existing = db.query(User).filter(User.google_id == google_id).first()
    if existing and existing.id != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Google account already linked to another user")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.email != email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google email must match the existing account email",
        )

    user.google_id = google_id
    user.auth_provider = AuthProvider.GOOGLE
    avatar_url = payload["picture"]
    if avatar_url:
        user.avatar_url = avatar_url
    db.flush()

    tokens = _build_tokens(db, user)
    db.commit()
    db.refresh(user)
    return GoogleLinkSuccessResponse(
        user=UserResponse.model_validate(user),
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


def forgot_password(db: Session, email: str, client_ip: str) -> dict:
    """Issue password reset email while returning a generic public-safe response."""
    normalized_email = email.strip().lower()

    if _is_forgot_password_rate_limited(client_ip, normalized_email):
        return {
            "detail": "If an account exists for this email, password reset instructions were sent.",
        }

    user = (
        db.query(User)
        .filter(User.email == normalized_email, User.auth_provider == AuthProvider.LOCAL, User.is_active.is_(True))
        .first()
    )

    if user:
        token = create_password_reset_token(user.id)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        user.password_reset_token_hash = _hash_password_reset_token(token)
        user.password_reset_token_expires_at = expires_at
        user.password_reset_requested_at = datetime.now(timezone.utc)

        reset_url = (
            f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={quote_plus(token)}"
        )
        sent = send_password_reset_email(
            to_email=user.email,
            username=user.username,
            reset_url=reset_url,
            expires_minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
        )
        if not sent:
            logger.warning("Password reset email could not be sent for user_id=%s", user.id)
        db.commit()

    return {
        "detail": "If an account exists for this email, password reset instructions were sent.",
    }


def reset_password(db: Session, token: str, new_password: str) -> None:
    """Reset local user password using a signed short-lived reset token."""
    payload = decode_password_reset_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user = db.query(User).filter(User.id == payload.sub).first()
    if not user or not user.is_active or user.auth_provider != AuthProvider.LOCAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token",
        )

    now = datetime.now(timezone.utc)
    token_hash = _hash_password_reset_token(token)
    if (
        not user.password_reset_token_hash
        or user.password_reset_token_hash != token_hash
        or not user.password_reset_token_expires_at
        or user.password_reset_token_expires_at < now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.password_hash = hash_password(new_password)
    user.password_reset_token_hash = None
    user.password_reset_token_expires_at = None
    user.password_reset_requested_at = None

    # Revoke all active sessions after a password reset.
    now = datetime.now(timezone.utc)
    (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .update({"revoked_at": now})
    )
    db.commit()


def change_password(db: Session, user_id: uuid.UUID, current_password: str, new_password: str) -> None:
    """Change password for an authenticated local user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.auth_provider != AuthProvider.LOCAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is only available for local accounts",
        )
    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid current password")

    user.password_hash = hash_password(new_password)

    # Revoke all sessions to force re-authentication after password change.
    logout_all_devices(db, user.id)
