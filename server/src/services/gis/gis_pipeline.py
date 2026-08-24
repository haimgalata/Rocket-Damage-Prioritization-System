"""GIS Feature Extraction Pipeline.

Orchestrates all GIS queries for a coordinate pair and returns a flat feature
dictionary. Each feature is fetched independently so a failure in one service
does not abort the whole pipeline.

Reliability model: a single absolute deadline is computed once per call and
threaded through every OSM-based proximity function down to the shared Overpass
helper (osm_query.py). No layer is ever allowed to *start* a new network attempt
once too little time remains to plausibly finish it before the deadline — this
bounds worst-case latency without relying on the ability to kill a running worker
thread (Python threads cannot be forcibly terminated; see osm_query.py's docstring
for the full rationale). The executor itself is a persistent, process-lifetime pool
that is never joined mid-request (previously `with ThreadPoolExecutor(...) as pool:`
implicitly called `shutdown(wait=True)` on exit, which blocked the caller on any
still-running straggler thread regardless of the per-future timeout already having
fired) — so a straggler thread riding out its own fixed per-attempt timeout in the
background cannot delay the caller past the harvesting deadline below.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait as wait_futures

logger = logging.getLogger(__name__)

_GIS_TIMEOUT_S = 120

_CACHE_TTL_S = 24 * 60 * 60      # GIS data (roads/hospitals/schools/population) is
                                  # effectively static; 24h keeps the cache useful
                                  # across bursts without letting it go stale forever.
_CACHE_MAX_SIZE = 5000

_cache_lock = threading.Lock()
_gis_cache: dict[tuple[float, float], tuple[dict, float]] = {}

# Persistent, process-lifetime executor — deliberately never entered via `with`, so
# extract_gis_features() never blocks on ThreadPoolExecutor's implicit
# shutdown(wait=True). Sized above the 5 tasks submitted per call so a handful of
# concurrent extract_gis_features() calls don't queue on the pool itself; the actual
# cap on cross-request Overpass load lives in osm_query.py's semaphore/circuit
# breaker instead.
_executor = ThreadPoolExecutor(max_workers=20, thread_name_prefix="gis-worker")


def _extract_distance(result) -> float:
    """Normalise proximity function return values to a single float distance."""
    if isinstance(result, tuple):
        return float(result[0])
    return float(result)


def _cache_get(key: tuple[float, float]):
    with _cache_lock:
        entry = _gis_cache.get(key)
        if entry is None:
            return None
        features, inserted_at = entry
        if time.monotonic() - inserted_at > _CACHE_TTL_S:
            del _gis_cache[key]
            return None
        return features


def _cache_set(key: tuple[float, float], features: dict) -> None:
    with _cache_lock:
        if key not in _gis_cache and len(_gis_cache) >= _CACHE_MAX_SIZE:
            oldest_key = min(_gis_cache, key=lambda k: _gis_cache[k][1])
            del _gis_cache[oldest_key]
        _gis_cache[key] = (features, time.monotonic())


def extract_gis_features(lat: float, lon: float) -> dict:
    """Orchestrate all GIS feature extractions for a given coordinate.

    Returns dict with keys: dist_hospital_m, dist_school_m, dist_military_base_m,
    dist_roads_m, population_density. Bounded to roughly `_GIS_TIMEOUT_S` seconds
    even if Overpass is completely unavailable — see module docstring.
    """
    # Rounded to 4 decimal places (~11m x ~9m cells at Israel's latitude, i.e.
    # smaller than a typical building footprint) so distinct nearby events don't
    # silently share a cache entry, while retries/duplicate submissions of the same
    # event still hit the cache. (Previously round(*, 3) ~= 111m x 94m cells, large
    # enough to merge two different buildings or opposite sides of a street.)
    cache_key = (round(lat, 4), round(lon, 4))
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info(f"[GIS] Cache hit for {cache_key}")
        return cached

    from server.src.services.gis.proximity.closest_hospital import distance_to_closest_hospital
    from server.src.services.gis.proximity.closest_school import distance_to_closest_school
    from server.src.services.gis.proximity.closest_military_base import distance_to_closest_military_or_helipad
    from server.src.services.gis.proximity.closest_road import distance_to_closest_road
    from server.src.services.gis.demographics.population_density import get_cbs_population_density

    deadline = time.monotonic() + _GIS_TIMEOUT_S

    # (function, default value on failure/timeout, unwrap tuple->distance, needs deadline)
    tasks = {
        "dist_hospital_m":      (distance_to_closest_hospital,            -1,  True,  True),
        "dist_school_m":        (distance_to_closest_school,              -1,  True,  True),
        "dist_military_base_m": (distance_to_closest_military_or_helipad, -1,  True,  True),
        "dist_roads_m":         (distance_to_closest_road,                -1,  True,  True),
        "population_density":   (get_cbs_population_density,              0.0, False, False),
    }

    futures = {}
    for key, (fn, _, _, needs_deadline) in tasks.items():
        args = (lat, lon, deadline) if needs_deadline else (lat, lon)
        futures[key] = _executor.submit(fn, *args)

    # A single shared deadline for the whole harvest, instead of one independent
    # future.result(timeout=...) per task — the latter can pathologically stack up
    # to 5x the intended timeout if every task is genuinely still running, since
    # each call permits its own full window regardless of how much wall-clock time
    # earlier iterations already consumed.
    done, not_done = wait_futures(futures.values(), timeout=_GIS_TIMEOUT_S)

    features = {}
    for key, future in futures.items():
        _, default, is_distance, _ = tasks[key]
        if future in not_done:
            logger.warning(f"{key} GIS timed out after {_GIS_TIMEOUT_S}s — using default")
            features[key] = default
            continue
        try:
            raw = future.result()
            features[key] = _extract_distance(raw) if is_distance else raw
        except Exception as e:
            logger.error(f"{key} GIS failed: {e}")
            features[key] = default

    logger.info(f"[GIS] Lat: {lat}, Lon: {lon} -> Features: {features}")
    _cache_set(cache_key, features)
    return features
