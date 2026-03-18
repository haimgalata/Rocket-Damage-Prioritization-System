"""
GIS service layer — thin wrapper over
:mod:`server.src.services.gis.gis_pipeline`.

Provides a single, stable entry point for geographic feature extraction
so that API route handlers are decoupled from the GIS pipeline
implementation.  All OSM queries, CBS data lookups, and distance
calculations remain encapsulated inside the pipeline module.
"""

from server.src.services.gis.gis_pipeline import extract_gis_features


def get_gis_features(lat: float, lon: float) -> dict:
    """Extract all GIS features for a geographic coordinate.

    Delegates to
    :func:`~server.src.services.gis.gis_pipeline.extract_gis_features`,
    which orchestrates five independent geographic services (hospital,
    school, military/helipad, road, population density) and returns a
    flat feature dictionary ready for priority scoring.

    Args:
        lat (float): Latitude of the damage event in decimal degrees
            (WGS-84 / EPSG:4326). Valid range: -90 to 90.
        lon (float): Longitude of the damage event in decimal degrees
            (WGS-84 / EPSG:4326). Valid range: -180 to 180.

    Returns:
        dict: Feature dictionary with the following keys:

            - ``"dist_hospital_m"`` (float): Distance to nearest
              hospital in metres, or ``-1`` if not found within 15 km.
            - ``"dist_school_m"`` (float): Distance to nearest school
              in metres, or ``-1`` if not found within 15 km.
            - ``"dist_military_base_m"`` (float): Distance to nearest
              military base or helipad in metres, or ``-1`` if not
              found within 15 km.
            - ``"dist_roads_m"`` (float): Distance to nearest road in
              metres, or ``-1`` if not found within 15 km.
            - ``"population_density"`` (float): Population density at
              the event location in persons per km², or ``0.0`` on
              failure.
    """
    return extract_gis_features(lat, lon)