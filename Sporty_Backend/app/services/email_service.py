import logging
from datetime import datetime
from importlib import import_module

from app.core.config import settings

logger = logging.getLogger(__name__)


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


def _render_password_reset_email_html(*, username: str, reset_url: str, expires_minutes: int) -> str:
    safe_username = username or "there"
    return f"""
<!doctype html>
<html>
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Reset your Sporty password</title>
    </head>
    <body style=\"margin:0;padding:0;background:#f4f6f8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1d2939;\">
        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:24px 12px;\">
            <tr>
                <td align=\"center\">
                    <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;\">
                        <tr>
                            <td style=\"padding:28px 28px 20px;background:linear-gradient(135deg,#11698e 0%,#1f7ea8 100%);color:#ffffff;\">
                                <div style=\"font-size:14px;font-weight:700;letter-spacing:.02em;opacity:.9;\">SPORTY</div>
                                <h1 style=\"margin:10px 0 0;font-size:24px;line-height:1.2;\">Reset your password</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style=\"padding:24px 28px 8px;font-size:16px;line-height:1.6;\">
                                <p style=\"margin:0 0 12px;\">Hi {safe_username},</p>
                                <p style=\"margin:0 0 16px;\">We received a request to reset your Sporty account password. Use the button below to continue.</p>
                            </td>
                        </tr>
                        <tr>
                            <td style=\"padding:0 28px 10px;\">
                                <a href=\"{reset_url}\" style=\"display:inline-block;background:#247ba0;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;\">Reset Password</a>
                            </td>
                        </tr>
                        <tr>
                            <td style=\"padding:8px 28px 0;font-size:14px;line-height:1.6;color:#475467;\">
                                <p style=\"margin:0 0 10px;\">This link expires in {expires_minutes} minutes and can only be used once.</p>
                                <p style=\"margin:0 0 10px;\">If you did not request this, you can ignore this email. Your current password remains unchanged.</p>
                                <p style=\"margin:0 0 20px;word-break:break-all;\">If the button does not work, copy and paste this URL:<br /><a href=\"{reset_url}\" style=\"color:#11698e;\">{reset_url}</a></p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
""".strip()


def send_transfer_window_open_email(
    *,
    to_email: str,
    username: str,
    league_name: str,
    start_at: datetime,
    end_at: datetime,
) -> bool:
    """Send transfer-window-open email via Resend.

    Returns True on success, False on soft failure.
    """
    html = (
        f"<p>Hi {username},</p>"
        f"<p>The transfer window for <strong>{league_name}</strong> is now open.</p>"
        f"<p>Open: {start_at.isoformat()}<br/>"
        f"Close: {end_at.isoformat()}</p>"
        "<p>Log in to Sporty and make your moves.</p>"
    )
    return _send_email_via_resend(
        to_email=to_email,
        subject=f"Transfer window is open: {league_name}",
        html=html,
    )


def send_password_reset_email(
    *,
    to_email: str,
    username: str,
    reset_url: str,
    expires_minutes: int,
) -> bool:
    """Send password reset email using a responsive HTML template."""
    html = _render_password_reset_email_html(
        username=username,
        reset_url=reset_url,
        expires_minutes=expires_minutes,
    )
    return _send_email_via_resend(
        to_email=to_email,
        subject="Reset your Sporty password",
        html=html,
    )
