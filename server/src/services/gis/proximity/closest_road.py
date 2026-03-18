"""
Nearest-road proximity service.

Queries OpenStreetMap via OSMnx for features tagged with common
``highway`` values, covering the full spectrum from motorways to
residential streets and service roads.

Road types searched (via ``highway`` tag):
    ``motorway``, ``trunk``, ``primary``, ``secondary``, ``tertiary``,
    ``residential``, ``unclassified``, ``service``.

A two-step progressive radius strategy (2 km → 15 km) is used:

- **2 km** — fast query suited for urban and suburban areas where
  roads are dense.
- **15 km** — fallback for rural or sparse areas where no road was
  found in the first pass.

Distance is measured in the EPSG:3857 projected CRS for metric accuracy.
"""

import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_road(lat: float, lon: float):
    """Compute the straight-line distance to the nearest road of any type.

    Searches for OSM features tagged with common ``highway`` values
    (motorway through service roads) using a two-step progressive radius
    strategy (2 km → 15 km).  Returns as soon as at least one qualifying
    road geometry is found.

    Distance measurement:

    1. Input coordinate is given in WGS-84 (EPSG:4326).
    2. Road geometries and the event point are reprojected to EPSG:3857
       (Web Mercator) for distance calculations in metres.
    3. The centroid of the closest road segment geometry is used as the
       representative point.

    Args:
        lat (float): Latitude of the damage event in decimal degrees
            (WGS-84). Valid range: -90 to 90.
        lon (float): Longitude of the damage event in decimal degrees
            (WGS-84). Valid range: -180 to 180.

    Returns:
        tuple[int, float, float] | int:
            - On success: ``(distance_m, found_lat, found_lon)`` where
              ``distance_m`` is the integer-rounded distance in metres to
              the nearest road segment, and ``found_lat`` / ``found_lon``
              are the WGS-84 centroid coordinates of that segment.
            - On failure (no road found within 15 km or OSM error on
              both radii): the integer ``-1``.
    """

    # Comprehensive list of road types from highways to residential streets
    road_tags = {
        "highway": [
            "motorway", "trunk", "primary", "secondary",
            "tertiary", "residential", "unclassified", "service"
        ]
    }

    # Search radii: Start with 2km for quick urban hits, expand to 15km for rural/empty areas
    search_radii = [2000, 15000]

    for radius in search_radii:
        try:
            roads_gdf = ox.features_from_point(
                (lat, lon),
                tags=road_tags,
                dist=radius
            )
        except (InsufficientResponseError, Exception):
            continue

        if roads_gdf.empty:
            continue

        # Project to metric CRS (EPSG:3857) for accurate distance in meters
        roads_gdf_metric = roads_gdf.to_crs(epsg=3857)

        event_point_metric = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        # Calculate distances to all roads found
        distances = roads_gdf_metric.distance(event_point_metric)

        # Get the minimum distance and its coordinates
        closest_idx = distances.idxmin()
        closest_geom = roads_gdf.loc[closest_idx].geometry

        # Use centroid coordinates of the closest segment
        found_lon, found_lat = closest_geom.centroid.coords[0]

        return int(round(distances.min())), found_lat, found_lon

    # No Road found within 15km radius
    return -1