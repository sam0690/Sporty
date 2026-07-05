import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import User
from app.support.models import SupportTicket, TicketMessage
from app.support.schemas import TicketCreateRequest


def create_ticket(db: Session, current_user: User, data: TicketCreateRequest) -> SupportTicket:
    ticket = SupportTicket(
        reporter_user_id=current_user.id,
        league_id=data.league_id,
        subject=data.subject,
        category=data.category,
    )
    db.add(ticket)
    db.flush()

    db.add(
        TicketMessage(
            ticket_id=ticket.id,
            author_user_id=current_user.id,
            body=data.body,
            is_internal_note=False,
        )
    )
    db.flush()
    return ticket


def list_my_tickets(
    db: Session, current_user: User, page: int, page_size: int
) -> tuple[list[SupportTicket], int]:
    query = (
        db.query(SupportTicket)
        .filter(SupportTicket.reporter_user_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_my_ticket(db: Session, current_user: User, ticket_id: uuid.UUID) -> SupportTicket:
    ticket = (
        db.query(SupportTicket)
        .filter(SupportTicket.id == ticket_id, SupportTicket.reporter_user_id == current_user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


def list_messages(db: Session, ticket_id: uuid.UUID, *, include_internal: bool) -> list[TicketMessage]:
    query = db.query(TicketMessage).filter(TicketMessage.ticket_id == ticket_id)
    if not include_internal:
        query = query.filter(TicketMessage.is_internal_note.is_(False))
    return query.order_by(TicketMessage.created_at.asc()).all()


def add_message(
    db: Session, ticket_id: uuid.UUID, author: User, body: str, *, is_internal_note: bool = False
) -> TicketMessage:
    message = TicketMessage(
        ticket_id=ticket_id, author_user_id=author.id, body=body, is_internal_note=is_internal_note
    )
    db.add(message)
    db.flush()
    return message


def add_my_message(db: Session, current_user: User, ticket_id: uuid.UUID, body: str) -> TicketMessage:
    get_my_ticket(db, current_user, ticket_id)  # 404s / enforces ownership
    return add_message(db, ticket_id, current_user, body, is_internal_note=False)
