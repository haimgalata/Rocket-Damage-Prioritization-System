import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_school(lat: float, lon: float):
    """
    Computes the distance (in meters) to the closest school
    using progressive search radii: 5 km, 10 km, 15 km
    Returns -1 if no school is found within 15km.
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

    # No school found within 15km
    return -1
