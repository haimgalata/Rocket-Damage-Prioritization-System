import geopandas as gpd
import osmnx as ox
import pandas as pd
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_military_or_helipad(lat: float, lon: float):
    """
    Computes the distance (in meters) to the closest strategic location
    (either a Military Base or a Helipad) using progressive search radii.
    Returns (distance, found_lat, found_lon) or -1 if none found within 15km.
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

    # Nothing found within 15km
    return -1