"""Transactional email — Ink & Gold branded templates sent via Resend.

Design notes (email HTML is its own universe — tables + inline styles only):
  - Hybrid theme: the app's dark "Ink & Gold" system doesn't survive email
    clients (Gmail dark-mode inversion, Outlook background stripping), so
    emails use a dark SPORTY header band + champagne-gold accents over a
    light, bulletproof body. Colors are the design-system tokens frozen to
    hex: ink #0a0a0f, gold #e2c368 (dim #b39a55), fg-1 #f2f2f0.
  - 3px corners everywhere — the brand's sharp broadcast edge.
  - Every user-supplied value is html.escape()d before interpolation.
"""

import html
import logging
from datetime import datetime
from importlib import import_module

from app.core.config import settings

logger = logging.getLogger(__name__)

_INK = "#0a0a0f"
_GOLD = "#e2c368"
_GOLD_DIM = "#b39a55"
_TEXT = "#17171d"
_TEXT_SOFT = "#5b5b66"
_TEXT_FAINT = "#8a8a93"
_FLOOR = "#ededf0"
_CARD_BORDER = "#e3e3e8"
_FONT = "Inter,'Segoe UI',Arial,sans-serif"


def _send_email_via_resend(*, to_email: str, subject: str, html: str) -> bool:
    """Send a generic HTML email via Resend."""
    if not settings.RESEND_API_KEY or not settings.FROM_EMAIL:
        logger.warning("Skipping email: RESEND_API_KEY or FROM_EMAIL not configured")
        return False

    try:
        resend = import_module("resend")
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def _render_branded_email(
    *,
    title: str,
    preheader: str,
    heading: str,
    body_html: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    footnote_html: str = "",
) -> str:
    """Shared Ink & Gold shell. `body_html`/`footnote_html` must already be
    safe HTML (escape any user-supplied values before building them)."""
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
                        <tr>
                            <td style="padding:6px 32px 22px;">
                                <a href="{cta_url}" style="display:inline-block;background:{_GOLD};color:{_INK};text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.01em;padding:13px 26px;border-radius:3px;">{cta_label}</a>
                            </td>
                        </tr>"""

    return f"""
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{html.escape(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:{_FLOOR};font-family:{_FONT};color:{_TEXT};">
        <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{html.escape(preheader)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid {_CARD_BORDER};border-radius:3px;overflow:hidden;">
                        <tr>
                            <td style="padding:26px 32px 22px;background:{_INK};border-bottom:2px solid {_GOLD};">
                                <div style="font-size:15px;font-weight:800;letter-spacing:.24em;color:{_GOLD};">SPORTY</div>
                                <h1 style="margin:12px 0 0;font-size:23px;line-height:1.25;font-weight:700;color:#f2f2f0;">{heading}</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:26px 32px 10px;font-size:16px;line-height:1.65;color:{_TEXT};">
                                {body_html}
                            </td>
                        </tr>{cta_block}
                        <tr>
                            <td style="padding:4px 32px 26px;font-size:13px;line-height:1.6;color:{_TEXT_SOFT};">
                                {footnote_html}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:16px 32px;background:#fafafa;border-top:1px solid {_CARD_BORDER};font-size:12px;color:{_TEXT_FAINT};">
                                Sporty — multi-sport fantasy leagues · <a href="{settings.FRONTEND_BASE_URL}" style="color:{_GOLD_DIM};text-decoration:none;">sportyyy.tech</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
""".strip()


def send_password_reset_email(
    *,
    to_email: str,
    username: str,
    reset_url: str,
    expires_minutes: int,
) -> bool:
    """Send password reset email. Returns True on success, False on soft failure."""
    safe_username = html.escape(username or "there")
    body = (
        f'<p style="margin:0 0 12px;">Hi {safe_username},</p>'
        '<p style="margin:0 0 6px;">We received a request to reset your Sporty '
        "account password. Use the button below to continue.</p>"
    )
    footnote = (
        f'<p style="margin:0 0 8px;">This link expires in <strong>{int(expires_minutes)} minutes</strong> and can only be used once.</p>'
        '<p style="margin:0 0 8px;">If you did not request this, you can ignore this email — your password remains unchanged.</p>'
        f'<p style="margin:0;word-break:break-all;">If the button does not work, copy and paste this URL:<br /><a href="{reset_url}" style="color:{_GOLD_DIM};">{reset_url}</a></p>'
    )
    return _send_email_via_resend(
        to_email=to_email,
        subject="Reset your Sporty password",
        html=_render_branded_email(
            title="Reset your Sporty password",
            preheader="Your password reset link — valid for a limited time.",
            heading="Reset your password",
            body_html=body,
            cta_label="Reset Password",
            cta_url=reset_url,
            footnote_html=footnote,
        ),
    )


def send_transfer_window_open_email(
    *,
    to_email: str,
    username: str,
    league_name: str,
    start_at: datetime,
    end_at: datetime,
) -> bool:
    """Send transfer-window-open email. Returns True on success, False on soft failure."""
    safe_username = html.escape(username)
    safe_league = html.escape(league_name)
    fmt = "%a %d %b %Y, %H:%M UTC"
    body = (
        f'<p style="margin:0 0 12px;">Hi {safe_username},</p>'
        f'<p style="margin:0 0 16px;">The transfer window for <strong>{safe_league}</strong> is now open.</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7;color:{_TEXT_SOFT};margin:0 0 6px;">'
        f'<tr><td style="padding-right:14px;color:{_GOLD_DIM};font-weight:700;">OPENS</td><td>{start_at.strftime(fmt)}</td></tr>'
        f'<tr><td style="padding-right:14px;color:{_GOLD_DIM};font-weight:700;">CLOSES</td><td>{end_at.strftime(fmt)}</td></tr>'
        "</table>"
    )
    return _send_email_via_resend(
        to_email=to_email,
        subject=f"Transfer window is open: {league_name}",
        html=_render_branded_email(
            title=f"Transfer window open — {league_name}",
            preheader=f"The transfer window for {league_name} is open. Make your moves.",
            heading="Transfer window is open",
            body_html=body,
            cta_label="Make Your Moves",
            cta_url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/transfers",
            footnote_html='<p style="margin:0;">You are receiving this because email notifications are enabled on your Sporty account. You can turn them off in Profile settings.</p>',
        ),
    )


def send_favourite_event_email(
    *,
    to_email: str,
    username: str,
    message: str,
) -> bool:
    """Send a favourite-team/player match-event email. Returns True on success."""
    safe_username = html.escape(username)
    safe_message = html.escape(message)
    body = (
        f'<p style="margin:0 0 12px;">Hi {safe_username},</p>'
        f'<p style="margin:0 0 6px;">{safe_message}</p>'
    )
    return _send_email_via_resend(
        to_email=to_email,
        subject="Sporty: your favourite just made a move",
        html=_render_branded_email(
            title="Your favourite just made a move",
            preheader=message,
            heading="Your favourite just made a move",
            body_html=body,
            cta_label="Watch Live",
            cta_url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/matches",
            footnote_html='<p style="margin:0;">You are receiving this because email notifications are enabled on your Sporty account. You can turn them off in Profile settings.</p>',
        ),
    )
