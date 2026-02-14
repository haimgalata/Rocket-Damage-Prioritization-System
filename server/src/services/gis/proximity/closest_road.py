import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_road(lat: float, lon: float):
    """
    Computes the distance (in meters) to the absolute closest road of any type.
    Uses progressive search radii (2km, 15km) for efficiency.
    Returns (distance, found_lat, found_lon) or -1 if no road is found.
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