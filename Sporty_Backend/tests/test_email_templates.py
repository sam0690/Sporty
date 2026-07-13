"""Branded email templates — escaping and structural invariants."""

from __future__ import annotations

from datetime import datetime, timezone

import app.services.email_service as email_service


def _capture(monkeypatch):
    sent = {}

    def fake_send(*, to_email, subject, html):
        sent.update(to=to_email, subject=subject, html=html)
        return True

    monkeypatch.setattr(email_service, "_send_email_via_resend", fake_send)
    return sent


def test_password_reset_renders_branded_and_escapes_username(monkeypatch):
    sent = _capture(monkeypatch)
    ok = email_service.send_password_reset_email(
        to_email="x@example.com",
        username='<img src=x onerror=alert(1)>',
        reset_url="https://sportyyy.tech/reset-password?token=abc",
        expires_minutes=30,
    )
    assert ok
    assert "<img src=x" not in sent["html"]          # escaped, not raw
    assert "&lt;img src=x" in sent["html"]
    assert "https://sportyyy.tech/reset-password?token=abc" in sent["html"]
    assert "SPORTY" in sent["html"] and "#e2c368" in sent["html"]  # gold wordmark band


def test_transfer_window_email_escapes_league_and_formats_dates(monkeypatch):
    sent = _capture(monkeypatch)
    email_service.send_transfer_window_open_email(
        to_email="x@example.com",
        username="sam",
        league_name="<b>Hack</b> & Sons",
        start_at=datetime(2026, 7, 13, 8, 0, tzinfo=timezone.utc),
        end_at=datetime(2026, 7, 20, 8, 0, tzinfo=timezone.utc),
    )
    assert "&lt;b&gt;Hack&lt;/b&gt; &amp; Sons" in sent["html"]
    assert "Mon 13 Jul 2026, 08:00 UTC" in sent["html"]
    assert "/transfers" in sent["html"]


def test_favourite_event_email_escapes_message(monkeypatch):
    sent = _capture(monkeypatch)
    email_service.send_favourite_event_email(
        to_email="x@example.com",
        username="sam",
        message="Salah scored! <script>evil()</script>",
    )
    assert "<script>" not in sent["html"]
    assert "Salah scored!" in sent["html"]
