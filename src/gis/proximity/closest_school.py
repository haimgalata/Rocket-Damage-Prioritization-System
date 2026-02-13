import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_school(lat: float, lon: float) -> float:
    """
    Computes the distance (in meters) to the closest school
    using progressive search radii: 3km, 5km.
    Returns 0 if no school is found within 5km.
    """

    search_radii = [500, 1000, 3000]

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
        schools_gdf = schools_gdf.to_crs(epsg=3857)

        # Event point in same CRS
        event_point = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        # Compute distances
        distances = schools_gdf.distance(event_point)

        #מדפיס נצ לבדיקה
        # # האינדקס של בית הספר הקרוב ביותר
        # closest_idx = distances.idxmin()
        #
        # # הגיאומטריה שלו (כרגע ב־EPSG:3857)
        # closest_geom = schools_gdf.loc[closest_idx].geometry
        #
        # # המרה חזרה ל־lat/lon לצורך debug
        # closest_geom_wgs84 = gpd.GeoSeries(
        #     [closest_geom],
        #     crs="EPSG:3857"
        # ).to_crs(epsg=4326).iloc[0]
        #
        # lon_found, lat_found = closest_geom_wgs84.centroid.coords[0]
        #
        # print(
        #     f"[DEBUG] Closest school found at: "
        #     f"lat={lat_found:.6f}, lon={lon_found:.6f}, "
        #     f"distance={int(round(distances.min()))}m"
        # )

        return int(round(distances.min()))


    # No school found within 3km
    return 0.0
