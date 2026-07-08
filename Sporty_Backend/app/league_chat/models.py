import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LeagueChatMessage(Base):
    __tablename__ = "league_chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    body: Mapped[str] = mapped_column(String(1000), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Soft delete — moderation/audit trail. Deleted messages are excluded
    # from list_messages but the row (and who deleted what, when) survives.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # String-based target (no import of auth.models here) — same
    # circular-import avoidance pattern used throughout this codebase.
    user: Mapped["User"] = relationship(foreign_keys=[user_id])


class LeagueChatReaction(Base):
    __tablename__ = "league_chat_reactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("league_chat_messages.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Validated against a small fixed allowlist at the service layer
    # (app/league_chat/services.py::ALLOWED_REACTION_EMOJIS) — not free text.
    emoji: Mapped[str] = mapped_column(String(8), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        # Reacting again with the same emoji toggles it off instead of
        # duplicating — enforced at the service layer, backed by this
        # constraint so a race can't create two rows for the same reaction.
        UniqueConstraint(
            "message_id", "user_id", "emoji",
            name="uq_chat_reaction_message_user_emoji",
        ),
    )
