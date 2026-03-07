import enum
import hashlib
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum as SAEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Auth provider enum ────────────────────────────────────────────────────────

class AuthProvider(str, enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"


# ── Step 1: User Model ───────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    # Issue 1: UUID PK — no sequential ID exposure, shard-safe
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Issue 2: Explicit auth provider — no guessing from nullable columns
    auth_provider: Mapped[AuthProvider] = mapped_column(
        SAEnum(AuthProvider, name="authprovider_enum", values_callable=lambda x: [e.value for e in x]), 
        nullable=False
    )

    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)

    # Issue 6: Avatar URL — stores Google profile picture (or future uploads)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Issue 5: timezone-aware, server-side defaults via func.now()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship: one user → many refresh tokens
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Issue 3: DB-level guard rails — prevent broken users
    __table_args__ = (
        CheckConstraint(
            "(auth_provider = 'local'  AND password_hash IS NOT NULL) OR "
            "(auth_provider = 'google' AND google_id    IS NOT NULL)",
            name="ck_user_auth_provider_fields",
        ),
    )


# ── Step 2: RefreshToken Model ────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Issue 4: Store SHA-256 hash of the token, not the raw JWT
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship back to user
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")

    @property
    def is_active(self) -> bool:
        """Token is active if not revoked and not expired."""
        from datetime import timezone
        return (
            self.revoked_at is None
            and self.expires_at > datetime.now(timezone.utc)
        )

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """One-way SHA-256 hash of a raw JWT string."""
        return hashlib.sha256(raw_token.encode()).hexdigest()

    @classmethod
    def create_for_user(cls, user_id: uuid.UUID) -> tuple["RefreshToken", str]:
        """
        Factory method — creates a RefreshToken DB object and returns
        the raw token to send to the client.

        Usage:
            db_token, raw_token = RefreshToken.create_for_user(user.id)
            db.add(db_token)
            db.commit()
            return raw_token  # ← this goes to the frontend

        Returns:
            (RefreshToken instance, raw token string)
            Caller adds the instance to the session.
            Caller sends the raw string to the client.
            The raw string is NEVER stored — only its hash is.
        """
        from app.core.security import create_refresh_token, get_refresh_token_expires_at

        raw = create_refresh_token()
        return cls(
            user_id=user_id,
            token_hash=cls.hash_token(raw),
            expires_at=get_refresh_token_expires_at(),
        ), raw
