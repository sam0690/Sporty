"""League chat — services never commit (router owns the transaction)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.models import User
from app.league.models import League
from app.league_chat.models import LeagueChatMessage, LeagueChatReaction

# Small fixed allowlist — keeps moderation simple, avoids arbitrary free-text
# "emoji" input (e.g. spoofed unicode, oversized grapheme clusters).
ALLOWED_REACTION_EMOJIS = {"👍", "🔥", "😂", "😢", "😮", "❤️"}

DEFAULT_MESSAGE_LIMIT = 50


def _serialize_messages(
    db: Session, messages: list[LeagueChatMessage], current_user: User, league: League
) -> list[dict]:
    if not messages:
        return []

    message_ids = [m.id for m in messages]
    reaction_rows = (
        db.query(LeagueChatReaction)
        .filter(LeagueChatReaction.message_id.in_(message_ids))
        .all()
    )
    reactions_by_message: dict[uuid.UUID, dict[str, dict]] = {}
    for row in reaction_rows:
        by_emoji = reactions_by_message.setdefault(row.message_id, {})
        entry = by_emoji.setdefault(row.emoji, {"count": 0, "reacted_by_me": False})
        entry["count"] += 1
        if row.user_id == current_user.id:
            entry["reacted_by_me"] = True

    return [
        {
            "id": message.id,
            "league_id": message.league_id,
            "user": message.user,
            "body": message.body,
            "created_at": message.created_at,
            "can_delete": (
                message.user_id == current_user.id or league.owner_id == current_user.id
            ),
            "reactions": [
                {"emoji": emoji, "count": data["count"], "reacted_by_me": data["reacted_by_me"]}
                for emoji, data in reactions_by_message.get(message.id, {}).items()
            ],
        }
        for message in messages
    ]


def list_messages(
    db: Session,
    league: League,
    current_user: User,
    *,
    limit: int = DEFAULT_MESSAGE_LIMIT,
) -> list[dict]:
    messages = (
        db.query(LeagueChatMessage)
        .options(joinedload(LeagueChatMessage.user))
        .filter(
            LeagueChatMessage.league_id == league.id,
            LeagueChatMessage.deleted_at.is_(None),
        )
        .order_by(LeagueChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()  # oldest -> newest for display
    return _serialize_messages(db, messages, current_user, league)


def post_message(
    db: Session, league: League, current_user: User, body: str
) -> dict:
    message = LeagueChatMessage(
        league_id=league.id, user_id=current_user.id, body=body.strip()
    )
    db.add(message)
    db.flush()
    db.refresh(message)
    return _serialize_messages(db, [message], current_user, league)[0]


def _get_message(db: Session, league_id: uuid.UUID, message_id: uuid.UUID) -> LeagueChatMessage:
    message = (
        db.query(LeagueChatMessage)
        .filter(
            LeagueChatMessage.id == message_id,
            LeagueChatMessage.league_id == league_id,
            LeagueChatMessage.deleted_at.is_(None),
        )
        .first()
    )
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return message


def delete_message(
    db: Session, league: League, message_id: uuid.UUID, current_user: User
) -> None:
    message = _get_message(db, league.id, message_id)
    if message.user_id != current_user.id and league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the sender or the commissioner can delete this message",
        )
    message.deleted_at = datetime.now(timezone.utc)
    db.flush()


def toggle_reaction(
    db: Session, league: League, message_id: uuid.UUID, current_user: User, emoji: str
) -> dict:
    if emoji not in ALLOWED_REACTION_EMOJIS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unsupported emoji")

    message = _get_message(db, league.id, message_id)

    existing = (
        db.query(LeagueChatReaction)
        .filter(
            LeagueChatReaction.message_id == message.id,
            LeagueChatReaction.user_id == current_user.id,
            LeagueChatReaction.emoji == emoji,
        )
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(
            LeagueChatReaction(message_id=message.id, user_id=current_user.id, emoji=emoji)
        )
    db.flush()

    return _serialize_messages(db, [message], current_user, league)[0]
