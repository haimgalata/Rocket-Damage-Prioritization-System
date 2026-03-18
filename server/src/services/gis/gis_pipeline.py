"""
GIS Feature Extraction Pipeline.

Orchestrates all geographic information system (GIS) queries for a single
coordinate pair and returns a flat feature dictionary ready for consumption
by :mod:`server.src.core.priority_logic`.

Each feature is fetched independently inside a ``try/except`` block so that
a failure in one GIS service (e.g. OSM API timeout) does not abort the whole
pipeline — the affected feature defaults to a safe sentinel value (-1 or 0).

Coordinate system: WGS-84 (EPSG:4326). All distance outputs are in metres.
"""

import logging

logger = logging.getLogger(__name__)


def _extract_distance(result) -> float:
    """Normalise the heterogeneous return values of proximity functions.

    Proximity functions in this package return one of two shapes depending on
    whether a feature was found:

    - **Found**:    ``(distance_m: int, found_lat: float, found_lon: float)``
    - **Not found**: ``-1`` (integer sentinel)

    This helper collapses both cases into a single ``float``, discarding the
    coordinate pair when present.

    Args:
        result (tuple[int, float, float] | int): The raw return value from a
            proximity function. Either a 3-tuple ``(distance, lat, lon)`` or
            the integer ``-1``.

    Returns:
        float: The distance in metres as a float, or ``-1.0`` when the
            feature was not found within the search radius.
    """
    if isinstance(result, tuple):
        return float(result[0])
    return float(result)  # -1


def extract_gis_features(lat: float, lon: float) -> dict:
    """Orchestrate all GIS feature extractions for a given coordinate.

    Calls five independent geographic services in sequence and aggregates
    the results into a single flat dictionary.  Each service call is wrapped
    in a ``try/except`` block; a failed call logs the error and inserts a
    default sentinel value so that downstream scoring is not blocked.

    Services called (in order):

    1. :func:`~server.src.services.gis.proximity.closest_hospital.distance_to_closest_hospital`
    2. :func:`~server.src.services.gis.proximity.closest_school.distance_to_closest_school`
    3. :func:`~server.src.services.gis.proximity.closest_military_base.distance_to_closest_military_or_helipad`
    4. :func:`~server.src.services.gis.proximity.closest_road.distance_to_closest_road`
    5. :func:`~server.src.services.gis.demographics.population_density.get_cbs_population_density`

    The returned dictionary keys match exactly the keys expected by
    :func:`~server.src.core.priority_logic.get_final_priority_score`.

    Args:
        lat (float): Latitude of the damage event in decimal degrees
            (WGS-84 / EPSG:4326). Valid range: -90 to 90.
        lon (float): Longitude of the damage event in decimal degrees
            (WGS-84 / EPSG:4326). Valid range: -180 to 180.

    Returns:
        dict: Feature dictionary with the following keys:

            - ``"dist_hospital_m"`` (float): Distance to nearest hospital in
              metres, or ``-1`` if not found within 15 km.
            - ``"dist_school_m"`` (float): Distance to nearest school in
              metres, or ``-1`` if not found within 15 km.
            - ``"dist_military_base_m"`` (float): Distance to nearest military
              base or helipad in metres, or ``-1`` if not found within 15 km.
            - ``"dist_roads_m"`` (float): Distance to nearest road in metres,
              or ``-1`` if not found within 15 km.
            - ``"population_density"`` (float): Population density at the
              event location in persons per km², or ``0.0`` on failure.

    Example::

        features = extract_gis_features(32.0853, 34.7818)
        # {
        #   "dist_hospital_m":     1200.0,
        #   "dist_school_m":       650.0,
        #   "dist_military_base_m": 3400.0,
        #   "dist_roads_m":        80.0,
        #   "population_density":  14500.0,
        # }
    """
    features = {}

    # ── Hospital ──────────────────────────────────────────────────────────────
    try:
        from server.src.services.gis.proximity.closest_hospital import distance_to_closest_hospital
        features["dist_hospital_m"] = _extract_distance(distance_to_closest_hospital(lat, lon))
    except Exception as e:
        logger.error(f"Hospital GIS failed: {e}")
        features["dist_hospital_m"] = -1

    # ── School ────────────────────────────────────────────────────────────────
    try:
        from server.src.services.gis.proximity.closest_school import distance_to_closest_school
        features["dist_school_m"] = _extract_distance(distance_to_closest_school(lat, lon))
    except Exception as e:
        logger.error(f"School GIS failed: {e}")
        features["dist_school_m"] = -1

    # ── Strategic (Military / Helipad) ────────────────────────────────────────
    try:
        from server.src.services.gis.proximity.closest_military_base import distance_to_closest_military_or_helipad
        features["dist_military_base_m"] = _extract_distance(distance_to_closest_military_or_helipad(lat, lon))
    except Exception as e:
        logger.error(f"Military/helipad GIS failed: {e}")
        features["dist_military_base_m"] = -1

    # ── Road ──────────────────────────────────────────────────────────────────
    try:
        from server.src.services.gis.proximity.closest_road import distance_to_closest_road
        features["dist_roads_m"] = _extract_distance(distance_to_closest_road(lat, lon))
    except Exception as e:
        logger.error(f"Road GIS failed: {e}")
        features["dist_roads_m"] = -1

    # ── Population Density ────────────────────────────────────────────────────
    try:
        from server.src.services.gis.demographics.population_density import get_cbs_population_density
        features["population_density"] = get_cbs_population_density(lat, lon)
    except Exception as e:
        logger.error(f"Population density failed: {e}")
        features["population_density"] = 0.0

    logger.info(f"GIS features for ({lat}, {lon}): {features}")
    return features