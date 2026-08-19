"""bcrypt truncates its input at 72 BYTES, silently.

Without a cap, any two passwords sharing their first 72 bytes hash identically
and both unlock the account. Capping is only safe on password *writes* — see
the login test for why.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.auth.schemas import ChangePasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest


def test_register_rejects_a_password_past_the_bcrypt_limit():
    with pytest.raises(ValidationError, match="72 bytes"):
        RegisterRequest(username="alice", email="a@example.com", password="a" * 73)


def test_register_accepts_exactly_the_limit():
    assert len(RegisterRequest(
        username="alice", email="a@example.com", password="a" * 72,
    ).password) == 72


def test_limit_is_measured_in_bytes_not_characters():
    """A plain max_length=72 would wave this through — 72 emoji is 288 bytes,
    still truncated by bcrypt, still a collision."""
    with pytest.raises(ValidationError, match="72 bytes"):
        RegisterRequest(username="alice", email="a@example.com", password="🔒" * 72)


@pytest.mark.parametrize(
    "model, kwargs",
    [
        (ResetPasswordRequest, {"token": "t"}),
        (ChangePasswordRequest, {"current_password": "old"}),
    ],
)
def test_password_writes_are_all_capped(model, kwargs):
    with pytest.raises(ValidationError, match="72 bytes"):
        model(new_password="a" * 73, **kwargs)


def test_login_is_deliberately_not_capped():
    """Anyone who registered a >72-byte password before the cap existed logs in
    today via truncation. Validating at login would reject the password they
    actually use and lock them out of their own account."""
    assert LoginRequest(identifier="alice", password="a" * 200).password == "a" * 200
