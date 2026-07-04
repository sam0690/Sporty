import logging
import time
import uuid
from importlib import import_module

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024


def _r2_client():
    boto3 = import_module("boto3")
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url(),
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _put_object(key: str, contents: bytes, content_type: str, cache_control: str | None = None) -> str:
    """Upload raw bytes to R2 under `key` and return the public URL."""
    if not settings.r2_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Object storage is not configured",
        )

    extra_args: dict[str, str] = {}
    if cache_control:
        extra_args["CacheControl"] = cache_control

    client = _r2_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=contents,
        ContentType=content_type,
        **extra_args,
    )

    base_url = settings.R2_PUBLIC_URL_BASE.rstrip("/")
    return f"{base_url}/{key}"


def upload_avatar(user_id: uuid.UUID, file: UploadFile, contents: bytes) -> str:
    """Upload an avatar image to R2 and return its public URL.

    Avatars can change any time a user re-uploads, so cache-bust with a
    version query param instead of a long-lived Cache-Control.
    """
    extension = ALLOWED_AVATAR_CONTENT_TYPES[file.content_type]
    key = f"avatars/{user_id}.{extension}"

    try:
        url = _put_object(key, contents, file.content_type)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to upload avatar for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to upload avatar",
        )

    return f"{url}?v={int(time.time())}"


def upload_team_logo(team_id: uuid.UUID, contents: bytes, content_type: str, extension: str) -> str:
    """Upload a real-team logo to R2 and return its public URL.

    Logos are effectively static once set, so cache them aggressively
    instead of cache-busting on every read.
    """
    key = f"team-logos/{team_id}.{extension}"
    try:
        return _put_object(key, contents, content_type, cache_control="public, max-age=31536000, immutable")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to upload team logo for team %s", team_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to upload team logo",
        )
