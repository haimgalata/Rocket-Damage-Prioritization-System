import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_hospital(lat: float, lon: float):
    """
    Computes the distance (in meters) to the closest hospital
    using progressive search radii: 5km, 10km, 15km.
    Returns 0 if no hospital is found within 15km.
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

    # No hospital found within 6km
    return -1
