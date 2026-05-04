"""
AI service — calls PrioritAI ML microservice over HTTP.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

from server.src.core.ai_fallback import fallback_classification_result

logger = logging.getLogger(__name__)

ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://127.0.0.1:8080").rstrip("/")
ML_SERVICE_API_KEY = os.environ.get("ML_SERVICE_API_KEY", "").strip()
_CONNECT_TIMEOUT = float(os.environ.get("ML_SERVICE_CONNECT_TIMEOUT", "5"))
_READ_TIMEOUT = float(os.environ.get("ML_SERVICE_READ_TIMEOUT", "120"))


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/octet-stream"}
    if ML_SERVICE_API_KEY:
        h["X-API-Key"] = ML_SERVICE_API_KEY
    return h


def _parse_prediction_payload(data: dict[str, Any]) -> dict[str, Any] | None:
    try:
        classification = data["classification"]
        damage_score = int(data["damage_score"])
        confidence = float(data["confidence"])
        fallback = bool(data.get("fallback", False))
    except (KeyError, TypeError, ValueError):
        return None
    return {
        "classification": classification,
        "damage_score": damage_score,
        "confidence": confidence,
        "fallback": fallback,
    }


def _post_predict(image_bytes: bytes) -> requests.Response:
    return requests.post(
        f"{ML_SERVICE_URL}/predict",
        data=image_bytes,
        headers=_headers(),
        timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
    )


def run_classification(image_bytes: bytes) -> dict[str, Any]:
    """Classify a damage image via ML service; on failure use local fallback."""
    if not image_bytes:
        return fallback_classification_result()
    if not ML_SERVICE_URL:
        logger.warning("ML_SERVICE_URL is empty; skipping ML request")
        return fallback_classification_result()

    try:
        resp = _post_predict(image_bytes)
        if resp.status_code == 503:
            logger.warning("ML service returned 503; retrying once")
            resp = _post_predict(image_bytes)
        if resp.status_code != 200:
            logger.warning(
                "ML service error: status=%s body=%s",
                resp.status_code,
                resp.text[:500] if resp.text else "",
            )
            return fallback_classification_result()
        parsed = _parse_prediction_payload(resp.json())
        if parsed is None:
            logger.warning("ML service returned invalid JSON shape")
            return fallback_classification_result()
        return parsed
    except requests.exceptions.RequestException as exc:
        logger.warning("ML service request failed: %s; retrying once", exc)
        try:
            resp = _post_predict(image_bytes)
            if resp.status_code == 200:
                parsed = _parse_prediction_payload(resp.json())
                if parsed is not None:
                    return parsed
        except requests.exceptions.RequestException as exc2:
            logger.warning("ML service retry failed: %s", exc2)
        return fallback_classification_result()
    except ValueError as exc:
        logger.warning("ML service JSON decode failed: %s", exc)
        return fallback_classification_result()
