"""
Nearest-school proximity service.

Queries OpenStreetMap via OSMnx for features tagged ``amenity=school``
within progressive search radii centred on a given coordinate. Distance is
measured in the EPSG:3857 projected CRS for metric accuracy.
"""

import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_school(lat: float, lon: float):
    """Compute the straight-line distance to the nearest school.

    Expands the search radius in three steps (5 km → 10 km → 15 km) and
    returns as soon as at least one school is found.  Progressive radii keep
    OSM queries lean for urban areas while providing fallback coverage for
    suburban and rural locations.

    Distance measurement:

    1. Input coordinate is given in WGS-84 (EPSG:4326).
    2. School geometries and the event point are reprojected to EPSG:3857
       (Web Mercator) for distance calculations in metres.
    3. The centroid of the closest school geometry is used as the
       representative point (handles Polygon and Point features equally).

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
              closest school's centroid.
            - On failure (no school within 15 km or OSM error on all
              radii): the integer ``-1``.
    """

    search_radii = [5000, 10000, 15000]

    for radius in search_radii:
        try:
            schools_gdf = ox.features_from_point(
                (lat, lon),
                tags={"amenity": "school"},
                dist=radius
            )
        except InsufficientResponseError:
            # No response / no features for this radius
            continue

        if schools_gdf.empty:
            continue

        # Project schools to metric CRS
        schools_gdf_metric = schools_gdf.to_crs(epsg=3857)

        event_point_metric = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        distances = schools_gdf_metric.distance(event_point_metric)

        closest_idx = distances.idxmin()

        closest_geom = schools_gdf.loc[closest_idx].geometry
        found_lon, found_lat = closest_geom.centroid.coords[0]

        return int(round(distances.min())), found_lat, found_lon

    # No school found within 15 km
    return -1