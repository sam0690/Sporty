import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import AuthProvider, RefreshToken, User
from app.auth.schemas import (
    GoogleAuthRequest,
    GoogleLinkRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.core.security import (
    create_access_token,
    hash_password,
    verify_google_id_token,
    verify_password,
)


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
    """Authenticate with username + password and return tokens."""

    user = db.query(User).filter(User.username == data.username).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    response = _build_tokens(db, user)
    db.commit()
    return response


def google_auth(db: Session, data: GoogleAuthRequest) -> TokenResponse:
    """Sign in (or register) via a Google ID token from the frontend."""

    payload = verify_google_id_token(data.id_token)
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
            # Don't auto-link — require explicit linking via /auth/google/link
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="account_exists_link_required",
            )
        else:
            # 3. Brand-new Google user → create account (no password)
            user = User(
                username=_generate_unique_username(db, email.split("@")[0]),
                email=email,
                auth_provider=AuthProvider.GOOGLE,
                google_id=google_id,
                avatar_url=avatar_url,
            )
            db.add(user)

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
) -> None:
    """
    Link a Google account to an existing (logged-in) user.
    Requires password verification for local accounts to prevent
    unauthorized account takeover.
    """
    payload = verify_google_id_token(data.id_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    google_id = payload.sub

    # Make sure this Google account isn't already linked to someone else
    existing = db.query(User).filter(User.google_id == google_id).first()
    if existing and existing.id != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Google account already linked to another user")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Local users must verify their password before linking
    if user.auth_provider == AuthProvider.LOCAL:
        if not data.password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password required to link Google account")
        if not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    user.google_id = google_id
    avatar_url = payload.picture
    if avatar_url:
        user.avatar_url = avatar_url
    db.commit()
