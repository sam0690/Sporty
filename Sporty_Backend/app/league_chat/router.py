"""League chat REST endpoints. Router owns the transaction.

Realtime fan-out: after each mutation, publish a JSON event to
f"{settings.LEAGUE_CHAT_PUBSUB_PREFIX}:{league_id}" — the same
best-effort, non-blocking pattern app/league/router.py already uses for
draft-started events (a Redis hiccup must never fail the request).
"""
import json
import logging
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.core.config import settings
from app.core.redis import get_redis
from app.database import get_db
from app.league.dependencies import require_league_member
from app.league.models import League
from app.league_chat import services as chat_service
from app.league_chat.schemas import ChatMessageCreate, ChatMessageResponse, ReactionToggleRequest

router = APIRouter(prefix="/leagues/{league_id}/chat", tags=["League Chat"])
logger = logging.getLogger(__name__)


def _chat_channel(league_id: uuid.UUID) -> str:
    return f"{settings.LEAGUE_CHAT_PUBSUB_PREFIX}:{league_id}"


def _publish(league_id: uuid.UUID, event: str, data: dict) -> None:
    try:
        get_redis().publish(
            _chat_channel(league_id),
            json.dumps({"event": event, "data": data}, default=str),
        )
    except Exception:  # noqa: BLE001 — realtime is a non-critical side channel
        logger.warning("Failed to publish chat %s for league %s", event, league_id, exc_info=True)


@router.get("/messages", response_model=list[ChatMessageResponse])
def list_messages(
    limit: int = Query(default=50, ge=1, le=200),
    league: League = Depends(require_league_member),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return chat_service.list_messages(db, league, current_user, limit=limit)


@router.post("/messages", response_model=ChatMessageResponse, status_code=201)
def post_message(
    payload: ChatMessageCreate,
    league: League = Depends(require_league_member),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    result = chat_service.post_message(db, league, current_user, payload.body)
    db.commit()
    _publish(league.id, "NEW_MESSAGE", result)
    return result


@router.delete("/messages/{message_id}", status_code=204)
def delete_message(
    message_id: uuid.UUID,
    league: League = Depends(require_league_member),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    chat_service.delete_message(db, league, message_id, current_user)
    db.commit()
    _publish(league.id, "MESSAGE_DELETED", {"id": str(message_id)})


@router.post("/messages/{message_id}/reactions", response_model=ChatMessageResponse)
def toggle_reaction(
    message_id: uuid.UUID,
    payload: ReactionToggleRequest,
    league: League = Depends(require_league_member),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    result = chat_service.toggle_reaction(db, league, message_id, current_user, payload.emoji)
    db.commit()
    _publish(league.id, "REACTION_TOGGLED", result)
    return result
