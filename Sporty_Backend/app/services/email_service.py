import logging
from datetime import datetime
from importlib import import_module

from app.core.config import settings

logger = logging.getLogger(__name__)


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
                "subject": f"Transfer window is open: {league_name}",
                "html": (
                    f"<p>Hi {username},</p>"
                    f"<p>The transfer window for <strong>{league_name}</strong> is now open.</p>"
                    f"<p>Open: {start_at.isoformat()}<br/>"
                    f"Close: {end_at.isoformat()}</p>"
                    "<p>Log in to Sporty and make your moves.</p>"
                ),
            }
        )
        return True
    except Exception:
        logger.exception("Failed to send transfer window email to %s", to_email)
        return False
