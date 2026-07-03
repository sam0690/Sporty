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


def upload_avatar(user_id: uuid.UUID, file: UploadFile, contents: bytes) -> str:
    """Upload an avatar image to R2 and return its public URL."""
    if not settings.r2_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Avatar upload is not configured",
        )

    extension = ALLOWED_AVATAR_CONTENT_TYPES[file.content_type]
    key = f"avatars/{user_id}.{extension}"

    try:
        client = _r2_client()
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=contents,
            ContentType=file.content_type,
        )
    except Exception:
        logger.exception("Failed to upload avatar for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to upload avatar",
        )

    base_url = settings.R2_PUBLIC_URL_BASE.rstrip("/")
    return f"{base_url}/{key}?v={int(time.time())}"
