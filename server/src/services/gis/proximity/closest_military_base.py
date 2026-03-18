"""
Nearest strategic-site proximity service.

Queries OpenStreetMap via OSMnx for features that represent strategic or
sensitive infrastructure:

- ``landuse=military``  — military bases, training areas, restricted zones.
- ``aeroway=helipad``   — helipads (often co-located with hospitals, bases,
  or government buildings).

Both tag types are fetched in a **single combined query** per radius to
minimise API round-trips.  Distance is measured in the EPSG:3857 projected
CRS for metric accuracy.
"""

import geopandas as gpd
import osmnx as ox
import pandas as pd
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_military_or_helipad(lat: float, lon: float):
    """Compute the straight-line distance to the nearest strategic site.

    A "strategic site" is defined as any OSM feature tagged with
    ``landuse=military`` or ``aeroway=helipad``.  Both types are searched
    simultaneously in each radius iteration to obtain the overall closest
    feature regardless of type.

    Expands the search radius in three steps (5 km → 10 km → 15 km) and
    returns as soon as at least one qualifying feature is found.

    Distance measurement:

    1. Input coordinate is given in WGS-84 (EPSG:4326).
    2. All matched geometries and the event point are reprojected to
       EPSG:3857 (Web Mercator) for distance calculations in metres.
    3. The centroid of each geometry is used as the representative point,
       correctly handling both Polygon (military areas) and Point (helipads)
       features.

    Args:
        lat (float): Latitude of the damage event in decimal degrees
            (WGS-84). Valid range: -90 to 90.
        lon (float): Longitude of the damage event in decimal degrees
            (WGS-84). Valid range: -180 to 180.

    Returns:
        tuple[int, float, float] | int:
            - On success: ``(distance_m, found_lat, found_lon)`` where
              ``distance_m`` is the integer-rounded distance in metres to the
              closest strategic site, and ``found_lat`` / ``found_lon`` are
              its WGS-84 centroid coordinates.
            - On failure (nothing found within 15 km or OSM error on all
              radii): the integer ``-1``.
    """

    search_radii = [5000, 10000, 15000]

    # Define both tags in a single dictionary for a combined search
    tags = {
        "landuse": "military",
        "aeroway": "helipad"
    }

    for radius in search_radii:
        try:
            # Combined search for both military bases and helipads
            combined_gdf = ox.features_from_point(
                (lat, lon),
                tags=tags,
                dist=radius
            )
        except InsufficientResponseError:
            continue

        if combined_gdf.empty:
            continue

        # Project to metric CRS for accurate distance calculation
        combined_gdf_metric = combined_gdf.to_crs(epsg=3857)

        event_point_metric = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        # Calculate distances to all found features
        distances = combined_gdf_metric.distance(event_point_metric)

        # Get the absolute closest feature (could be a base or a helipad)
        closest_idx = distances.idxmin()
        closest_geom = combined_gdf.loc[closest_idx].geometry

        # Get coordinates of the found location
        # Handle both Point and Polygon geometries using centroid
        found_lon, found_lat = closest_geom.centroid.coords[0]

        return int(round(distances.min())), found_lat, found_lon

    # Nothing found within 15 km
    return -1