"""Overpass query helper with multi-endpoint fallback, retry, deadline, and circuit-breaking.

Single source of truth for OSM/Overpass network behavior. Callers pass an optional
absolute `deadline` (a `time.monotonic()` timestamp); no new HTTP attempt (primary
retry or fallback endpoint) is started unless enough budget remains to plausibly
complete it. Combined with a per-endpoint circuit breaker and a process-wide
concurrency cap, this bounds worst-case latency without needing to kill an in-flight
thread: Python cannot forcibly terminate a running thread (`future.cancel()` is a
no-op once a worker has started, and a blocking HTTP call has no safe interrupt
point), so the only reliable way to bound latency is to never *start* an attempt
that can't finish in time, and let any already-started attempt run to its own fixed
timeout in the background.
"""

import time
import threading
import logging

import osmnx as ox

logger = logging.getLogger(__name__)

# Single source of truth for OSMnx's own HTTP timeout — previously set redundantly
# (to the same value) at import time in each of the four proximity modules. Kept
# small and fixed rather than dynamically resized per remaining deadline, because
# ox.settings.timeout is unguarded global state read by osmnx from whichever thread
# happens to be mid-request — mutating it dynamically would just relocate the same
# race condition that overpass_url has (see _endpoint_lock below) onto timeout.
# Instead, an attempt is only allowed to *start* if enough deadline budget remains to
# cover one full attempt at this fixed timeout.
_OSM_ATTEMPT_TIMEOUT_S = 6
ox.settings.timeout = _OSM_ATTEMPT_TIMEOUT_S
ox.settings.use_cache = True

_RETRY_SLEEP_S = 3

_FALLBACK_ENDPOINTS = [
    "https://overpass.kumi.systems/api",
    "https://lz4.overpass-api.de/api",
]

# Guards the entire capture -> mutate -> call -> restore sequence for a fallback
# attempt as one unit. Previously `original_url` was captured and restored *outside*
# the lock, so two concurrent fallback attempts could interleave such that one
# thread "restored" the global to the other thread's fallback endpoint instead of
# the true original. Widening the critical section to the whole sequence closes
# that race; the cost is serializing fallback-path Overpass calls process-wide,
# which is acceptable since fallback should be rare and arguably desirable (it
# naturally caps load on already-degraded infrastructure).
_endpoint_lock = threading.Lock()

# --- Circuit breaker: remembers which endpoints have been failing recently, so an
# outage is discovered once and subsequent calls — including later radii within the
# same proximity function, and concurrent calls from other threads/requests — skip
# straight past a known-bad endpoint instead of re-running its full retry dance. ---
_FAILURE_THRESHOLD = 3
_BASE_COOLDOWN_S = 60
_MAX_COOLDOWN_S = 600
_breaker_lock = threading.Lock()
_endpoint_failures: dict[str, int] = {}
_endpoint_cooldown_until: dict[str, float] = {}

# --- Process-wide concurrency limit across ALL simultaneous pipeline invocations,
# not just the (up to 4 OSM-based) workers inside one extract_gis_features() call —
# caps how hard multiple concurrent event submissions can hammer Overpass. ---
_MAX_CONCURRENT_REQUESTS = 6
_request_semaphore = threading.Semaphore(_MAX_CONCURRENT_REQUESTS)


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(x in msg for x in ("429", "504", "timed out", "connection", "remote end"))


def _endpoint_available(endpoint: str) -> bool:
    with _breaker_lock:
        return time.monotonic() >= _endpoint_cooldown_until.get(endpoint, 0)


def _record_success(endpoint: str) -> None:
    with _breaker_lock:
        _endpoint_failures.pop(endpoint, None)
        _endpoint_cooldown_until.pop(endpoint, None)


def _record_failure(endpoint: str) -> None:
    with _breaker_lock:
        count = _endpoint_failures.get(endpoint, 0) + 1
        _endpoint_failures[endpoint] = count
        if count >= _FAILURE_THRESHOLD:
            cooldown = min(_BASE_COOLDOWN_S * (2 ** (count - _FAILURE_THRESHOLD)), _MAX_COOLDOWN_S)
            _endpoint_cooldown_until[endpoint] = time.monotonic() + cooldown
            logger.warning(f"[OSM] Endpoint {endpoint} tripped circuit breaker — cooling down {cooldown:.0f}s")


def _remaining(deadline: float | None) -> float:
    """Seconds left until `deadline`, or +inf if no deadline was given."""
    if deadline is None:
        return float("inf")
    return deadline - time.monotonic()


def features_from_point(center_point, tags: dict, dist: int, deadline: float | None = None):
    """Query Overpass for OSM features with retry, endpoint fallback, and a shared deadline.

    Tries the default endpoint up to 2 times, then falls back to alternative mirrors.

    `deadline` is an absolute `time.monotonic()` timestamp by which this call should
    return control to the caller. No new attempt (primary retry or fallback
    endpoint) is started unless there's enough remaining budget to cover one full
    attempt at `_OSM_ATTEMPT_TIMEOUT_S` — this bounds worst-case latency without
    requiring the ability to cancel an in-flight HTTP request. If `deadline` is
    None, behaves as before (bounded only by `_OSM_ATTEMPT_TIMEOUT_S` per attempt).
    """
    last_exc: Exception | None = None

    sem_timeout = None if deadline is None else max(0.0, _remaining(deadline))
    if not _request_semaphore.acquire(timeout=sem_timeout):
        raise TimeoutError("GIS deadline exceeded waiting for an Overpass request slot")

    try:
        primary_endpoint = ox.settings.overpass_url

        for attempt in range(2):
            if _remaining(deadline) < _OSM_ATTEMPT_TIMEOUT_S:
                raise TimeoutError("GIS deadline exceeded before Overpass attempt could start") from last_exc
            if not _endpoint_available(primary_endpoint):
                logger.info(f"[OSM] Primary endpoint {primary_endpoint} in cooldown, skipping to fallback")
                break
            if attempt > 0:
                time.sleep(min(_RETRY_SLEEP_S, max(0.0, _remaining(deadline) - _OSM_ATTEMPT_TIMEOUT_S)))
            try:
                result = ox.features_from_point(center_point, tags=tags, dist=dist)
                _record_success(primary_endpoint)
                return result
            except Exception as exc:
                if _is_rate_limit(exc):
                    logger.warning(
                        f"[OSM] Primary endpoint attempt {attempt + 1} failed "
                        f"({type(exc).__name__})"
                    )
                    last_exc = exc
                    _record_failure(primary_endpoint)
                else:
                    raise

        original_url = ox.settings.overpass_url
        for endpoint in _FALLBACK_ENDPOINTS:
            if _remaining(deadline) < _OSM_ATTEMPT_TIMEOUT_S:
                break
            if not _endpoint_available(endpoint):
                logger.info(f"[OSM] Fallback endpoint {endpoint} in cooldown, skipping")
                continue
            with _endpoint_lock:
                try:
                    logger.info(f"[OSM] Trying fallback endpoint: {endpoint}")
                    ox.settings.overpass_url = endpoint
                    result = ox.features_from_point(center_point, tags=tags, dist=dist)
                    _record_success(endpoint)
                    return result
                except Exception as exc:
                    if _is_rate_limit(exc):
                        logger.warning(f"[OSM] Fallback {endpoint} also failed: {type(exc).__name__}")
                        last_exc = exc
                        _record_failure(endpoint)
                    else:
                        raise
                finally:
                    ox.settings.overpass_url = original_url

        raise last_exc or TimeoutError("All Overpass endpoints exhausted or deadline exceeded")
    finally:
        _request_semaphore.release()
