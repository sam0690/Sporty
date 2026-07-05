import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.support import services
from app.support.schemas import (
    TicketCreateRequest,
    TicketDetailResponse,
    TicketListResponse,
    TicketMessageCreateRequest,
    TicketMessageResponse,
    TicketResponse,
)

router = APIRouter(prefix="/support", tags=["Support"])


@router.post("/tickets", response_model=TicketResponse, summary="Open a support ticket")
def create_ticket(
    data: TicketCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ticket = services.create_ticket(db, current_user, data)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/tickets", response_model=TicketListResponse, summary="List my support tickets")
def list_my_tickets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    items, total = services.list_my_tickets(db, current_user, page, page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


@router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse, summary="Get one of my tickets")
def get_ticket(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ticket = services.get_my_ticket(db, current_user, ticket_id)
    messages = services.list_messages(db, ticket_id, include_internal=False)
    return TicketDetailResponse(
        id=ticket.id,
        reporter_user_id=ticket.reporter_user_id,
        league_id=ticket.league_id,
        subject=ticket.subject,
        category=ticket.category,
        priority=ticket.priority,
        status=ticket.status,
        assigned_admin_user_id=ticket.assigned_admin_user_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        resolved_at=ticket.resolved_at,
        messages=[TicketMessageResponse.model_validate(m) for m in messages],
    )


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=TicketMessageResponse,
    summary="Reply to one of my tickets",
)
def add_message(
    ticket_id: uuid.UUID,
    data: TicketMessageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    message = services.add_my_message(db, current_user, ticket_id, data.body)
    db.commit()
    db.refresh(message)
    return message
