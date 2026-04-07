"""
core/security.py
─────────────────
Pure functions. Zero I/O. Zero DB imports. Zero FastAPI imports.
Every function is independently testable with plain Python data.
"""

import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Structured return types ───────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class AccessTokenPayload:
    """Decoded contents of a valid access JWT — only what callers need."""
    sub: uuid.UUID


@dataclass(frozen=True, slots=True)
class GooglePayload:
    """Relevant fields extracted from a verified Google ID token."""
    sub: str                    # stable Google user ID
    email: str
    email_verified: bool
    name: str | None = None
    picture: str | None = None


@dataclass(frozen=True, slots=True)
class PasswordResetPayload:
    """Decoded contents of a valid password reset JWT."""
    sub: uuid.UUID


# ── Password hashing ─────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT / tokens ──────────────────────────────────────────────────────────────

def create_access_token(user_id: uuid.UUID) -> str:
    """Create a short-lived access JWT with an explicit user_id."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire, "iat": now, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> str:
    """
    Create an opaque, cryptographically random refresh token.
    Not a JWT — no payload to decode. Looked up by hash in the DB.
    """
    return secrets.token_urlsafe(64)


def create_password_reset_token(user_id: uuid.UUID) -> str:
    """Create a short-lived password reset JWT."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire, "iat": now, "type": "password_reset"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def get_refresh_token_expires_at() -> datetime:
    """Single source of truth for refresh token expiry."""
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


def decode_access_token(token: str) -> AccessTokenPayload | None:
    """
    Decode and validate an *access* JWT.
    Returns an AccessTokenPayload on success, or None on any failure
    (expired, tampered, wrong type, etc.).
    """
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None

    if payload.get("type") != "access":
        return None

    try:
        return AccessTokenPayload(
            sub=uuid.UUID(payload["sub"]),
        )
    except (KeyError, ValueError):
        return None


def decode_password_reset_token(token: str) -> PasswordResetPayload | None:
    """Decode and validate a password reset JWT."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None

    if payload.get("type") != "password_reset":
        return None

    try:
        return PasswordResetPayload(sub=uuid.UUID(payload["sub"]))
    except (KeyError, ValueError):
        return None


# ── Google OAuth ──────────────────────────────────────────────────────────────

def verify_google_id_token(token: str) -> GooglePayload | None:
    """
    Verify the ID token sent by the frontend after Google sign-in.
    Returns a GooglePayload on success, or None on failure.
    Validates issuer and email_verified before returning.
    """
    try:
        data = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        # Verify issuer — must be Google
        issuer = data.get("iss")
        if issuer not in ("accounts.google.com", "https://accounts.google.com"):
            logger.warning("Google token has unexpected issuer: %s", issuer)
            return None

        # Reject unverified emails
        email_verified = data.get("email_verified", False)
        if not email_verified:
            logger.warning("Google token has unverified email: %s", data.get("email"))
            return None

        return GooglePayload(
            sub=data["sub"],
            email=data["email"],
            email_verified=email_verified,
            name=data.get("name"),
            picture=data.get("picture"),
        )
    except Exception:
        logger.exception("Google ID token verification failed")
        return None
