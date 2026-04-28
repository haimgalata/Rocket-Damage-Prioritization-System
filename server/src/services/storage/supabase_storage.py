"""Supabase Storage upload helper for event images."""

import logging
import mimetypes
import os
import uuid
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

SUPABASE_BUCKET = "event-images"


class SupabaseStorageError(RuntimeError):
    """Raised when Supabase Storage upload fails."""


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SupabaseStorageError(f"Missing required environment variable: {name}")
    return value


def _resolve_content_type(
    original_filename: str | None,
    declared_content_type: str | None,
) -> str:
    """Resolve a safe image Content-Type for storage upload."""
    if declared_content_type and declared_content_type.startswith("image/"):
        return declared_content_type

    guessed, _ = mimetypes.guess_type(original_filename or "")
    if guessed and guessed.startswith("image/"):
        return guessed

    suffix = Path(original_filename or "").suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".gif":
        return "image/gif"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".avif":
        return "image/avif"

    return "application/octet-stream"


def upload_event_image(
    image_bytes: bytes,
    original_filename: str | None = None,
    declared_content_type: str | None = None,
) -> str:
    """Upload image bytes to Supabase Storage and return public URL."""
    if not image_bytes:
        raise SupabaseStorageError("Cannot upload an empty image.")

    supabase_url = _require_env("SUPABASE_URL").rstrip("/")
    supabase_key = _require_env("SUPABASE_KEY")

    suffix = Path(original_filename or "").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{suffix}"

    upload_url = f"{supabase_url}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"
    content_type = _resolve_content_type(original_filename, declared_content_type)
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": content_type,
        "x-upsert": "false",
    }

    try:
        response = requests.post(upload_url, headers=headers, data=image_bytes, timeout=30)
    except requests.RequestException as exc:
        logger.exception("Supabase Storage request failed.")
        raise SupabaseStorageError("Failed to upload image to Supabase Storage.") from exc

    if response.status_code >= 400:
        logger.error("Supabase Storage upload rejected with status %s.", response.status_code)
        raise SupabaseStorageError("Supabase Storage rejected image upload.")

    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"
