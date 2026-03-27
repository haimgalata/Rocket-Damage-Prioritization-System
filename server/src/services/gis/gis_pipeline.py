"""GIS Feature Extraction Pipeline.

Orchestrates all GIS queries for a coordinate pair and returns a flat feature
dictionary. Each feature is fetched independently so a failure in one service
does not abort the whole pipeline.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

logger = logging.getLogger(__name__)

_GIS_TIMEOUT_S = 35

_gis_cache: dict[tuple[float, float], dict] = {}


def _extract_distance(result) -> float:
    """Normalise proximity function return values to a single float distance."""
    if isinstance(result, tuple):
        return float(result[0])
    return float(result)


def extract_gis_features(lat: float, lon: float) -> dict:
    """Orchestrate all GIS feature extractions for a given coordinate.

    Returns dict with keys: dist_hospital_m, dist_school_m, dist_military_base_m,
    dist_roads_m, population_density.
    """
    cache_key = (round(lat, 3), round(lon, 3))
    if cache_key in _gis_cache:
        logger.info(f"[GIS] Cache hit for {cache_key}")
        return _gis_cache[cache_key]

    from server.src.services.gis.proximity.closest_hospital import distance_to_closest_hospital
    from server.src.services.gis.proximity.closest_school import distance_to_closest_school
    from server.src.services.gis.proximity.closest_military_base import distance_to_closest_military_or_helipad
    from server.src.services.gis.proximity.closest_road import distance_to_closest_road
    from server.src.services.gis.demographics.population_density import get_cbs_population_density

    tasks = {
        "dist_hospital_m":      (distance_to_closest_hospital,            -1,  True),
        "dist_school_m":        (distance_to_closest_school,              -1,  True),
        "dist_military_base_m": (distance_to_closest_military_or_helipad, -1,  True),
        "dist_roads_m":         (distance_to_closest_road,                -1,  True),
        "population_density":   (get_cbs_population_density,              0.0, False),
    }

    features = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            key: pool.submit(fn, lat, lon)
            for key, (fn, _, _) in tasks.items()
        }
        for key, future in futures.items():
            _, default, is_distance = tasks[key]
            try:
                raw = future.result(timeout=_GIS_TIMEOUT_S)
                features[key] = _extract_distance(raw) if is_distance else raw
            except FutureTimeoutError:
                logger.warning(f"{key} GIS timed out after {_GIS_TIMEOUT_S}s — using default")
                features[key] = default
            except Exception as e:
                logger.error(f"{key} GIS failed: {e}")
                features[key] = default

    logger.info(f"[GIS] Lat: {lat}, Lon: {lon} -> Features: {features}")
    _gis_cache[cache_key] = features
    return features
