"""WS ticket — short-lived token for authenticated WebSocket handshakes.

The ticket must round-trip through decode_ws_ticket, must NOT be usable as
an HTTP access token (type confusion), and an access token must not decode
as a ticket.
"""

from __future__ import annotations

import uuid

from app.core.security import (
    create_access_token,
    create_ws_ticket,
    decode_access_token,
    decode_ws_ticket,
)


def test_ws_ticket_roundtrip():
    user_id = uuid.uuid4()
    ticket = create_ws_ticket(user_id)
    payload = decode_ws_ticket(ticket)
    assert payload is not None
    assert payload.sub == user_id


def test_ws_ticket_is_not_an_access_token():
    ticket = create_ws_ticket(uuid.uuid4())
    assert decode_access_token(ticket) is None


def test_access_token_is_not_a_ws_ticket():
    token = create_access_token(uuid.uuid4())
    assert decode_ws_ticket(token) is None


def test_garbage_is_rejected():
    assert decode_ws_ticket("not-a-jwt") is None
