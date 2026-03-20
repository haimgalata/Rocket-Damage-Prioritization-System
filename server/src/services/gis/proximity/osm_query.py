"""Overpass query helper with multi-endpoint fallback and retry."""

import time
import threading
import logging

import osmnx as ox

logger = logging.getLogger(__name__)

_FALLBACK_ENDPOINTS = [
    "https://overpass.kumi.systems/api",
    "https://lz4.overpass-api.de/api",
]

_endpoint_lock = threading.Lock()


def features_from_point(center_point, tags: dict, dist: int):
    """Query Overpass for OSM features with automatic retry and endpoint fallback.

    Tries the default endpoint up to 2 times, then falls back to alternative mirrors.
    """
    def _is_rate_limit(exc: Exception) -> bool:
        msg = str(exc).lower()
        return any(x in msg for x in ("429", "504", "timed out", "connection", "remote end"))

    last_exc: Exception | None = None
    for attempt in range(2):
        if attempt > 0:
            time.sleep(3)
        try:
            return ox.features_from_point(center_point, tags=tags, dist=dist)
        except Exception as exc:
            if _is_rate_limit(exc):
                logger.warning(
                    f"[OSM] Primary endpoint attempt {attempt + 1} failed "
                    f"({type(exc).__name__})"
                )
                last_exc = exc
            else:
                raise

    original_url = ox.settings.overpass_url
    for endpoint in _FALLBACK_ENDPOINTS:
        try:
            logger.info(f"[OSM] Trying fallback endpoint: {endpoint}")
            with _endpoint_lock:
                ox.settings.overpass_url = endpoint
                result = ox.features_from_point(center_point, tags=tags, dist=dist)
            ox.settings.overpass_url = original_url
            return result
        except Exception as exc:
            ox.settings.overpass_url = original_url
            if _is_rate_limit(exc):
                logger.warning(f"[OSM] Fallback {endpoint} also failed: {type(exc).__name__}")
                last_exc = exc
                continue
            raise

    raise last_exc or Exception("All Overpass endpoints exhausted")
