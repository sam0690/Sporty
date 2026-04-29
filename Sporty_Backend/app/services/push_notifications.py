"""Push delivery adapters for FCM and APNs."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


_firebase_initialized = False


def _init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return

    if not settings.FIREBASE_CREDENTIALS_PATH:
        return

    try:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
    except Exception:
        logger.exception("Failed to initialize Firebase")


async def send_fcm(token: str, title: str, body: str, data: dict[str, Any]) -> bool:
    _init_firebase()
    if not _firebase_initialized:
        return False

    try:
        from firebase_admin import messaging

        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in data.items()},
        )
        messaging.send(message)
        return True
    except Exception:
        logger.exception("FCM send failed")
        return False


async def send_apns(device_token: str, title: str, body: str, payload: dict[str, Any]) -> bool:
    if not (settings.APNS_KEY_PATH and settings.APNS_KEY_ID and settings.APNS_TEAM_ID and settings.APNS_BUNDLE_ID):
        return False

    try:
        from apns2.client import APNsClient
        from apns2.credentials import TokenCredentials
        from apns2.payload import Payload

        credentials = TokenCredentials(
            auth_key_path=settings.APNS_KEY_PATH,
            auth_key_id=settings.APNS_KEY_ID,
            team_id=settings.APNS_TEAM_ID,
        )
        client = APNsClient(credentials=credentials, use_sandbox=settings.APNS_USE_SANDBOX)
        apns_payload = Payload(alert={"title": title, "body": body}, custom=payload)
        client.send_notification(device_token, apns_payload, topic=settings.APNS_BUNDLE_ID)
        return True
    except Exception:
        logger.exception("APNs send failed")
        return False
