"""
Nearest-hospital proximity service.

Queries OpenStreetMap via the OSMnx library for hospital features tagged
``amenity=hospital`` within progressive search radii centred on a given
coordinate. Distance is measured in the Web Mercator projected coordinate
system (EPSG:3857) for metric accuracy.
"""

import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_hospital(lat: float, lon: float):
    """Compute the straight-line distance to the nearest hospital.

    Expands the search radius in three steps (5 km → 10 km → 15 km) and
    returns as soon as at least one hospital is found.  Using progressive
    radii avoids unnecessarily large OSM queries in dense urban areas while
    still providing coverage for rural locations.

    Distance measurement:

    1. Input coordinate is given in WGS-84 (EPSG:4326).
    2. Both the hospital geometries and the event point are reprojected to
       EPSG:3857 (Web Mercator) to obtain distances in metres.
    3. The centroid of the closest hospital geometry is used as the
       representative point (handles both Polygon and Point OSM features).

    Args:
        lat (float): Latitude of the damage event in decimal degrees
            (WGS-84). Valid range: -90 to 90.
        lon (float): Longitude of the damage event in decimal degrees
            (WGS-84). Valid range: -180 to 180.

    Returns:
        tuple[int, float, float] | int:
            - On success: ``(distance_m, found_lat, found_lon)`` where
              ``distance_m`` is the integer-rounded distance in metres, and
              ``found_lat`` / ``found_lon`` are the WGS-84 coordinates of the
              closest hospital's centroid.
            - On failure (no hospital within 15 km or OSM error on all
              radii): the integer ``-1``.
    """

    search_radii = [5000, 10000, 15000]

    for radius in search_radii:
        try:
            hospitals_gdf = ox.features_from_point(
                (lat, lon),
                tags={"amenity": "hospital"},
                dist=radius
            )
        except InsufficientResponseError:
            # Nothing found for this radius
            continue

        if hospitals_gdf.empty:
            continue

        # Project to metric CRS
        hospitals_gdf_metric = hospitals_gdf.to_crs(epsg=3857)

        event_point_metric = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        distances = hospitals_gdf_metric.distance(event_point_metric)

        closest_idx = distances.idxmin()

        closest_geom = hospitals_gdf.loc[closest_idx].geometry
        found_lon, found_lat = closest_geom.centroid.coords[0]

        return int(round(distances.min())), found_lat, found_lon

    # No hospital found within 15 km
    return -1