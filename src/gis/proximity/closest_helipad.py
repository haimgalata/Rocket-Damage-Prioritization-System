import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_helipad(lat: float, lon: float) -> float:
    """
    Computes the distance (in meters) to the closest helipad
    using progressive search radii: 3km, 7km, 15km.
    Returns 0 if no helipad is found within 15km.
    """

    search_radii = [3000, 7000, 15000]

    for radius in search_radii:
        try:
            helipads_gdf = ox.features_from_point(
                (lat, lon),
                tags={"aeroway": "helipad"},
                dist=radius
            )
        except InsufficientResponseError:
            continue

        if helipads_gdf.empty:
            continue

        # Project to metric CRS
        helipads_gdf = helipads_gdf.to_crs(epsg=3857)

        event_point = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        distances = helipads_gdf.distance(event_point)

        # #מדפיס נצ לבדיקה
        # # האינדקס של המנחת הקרוב ביותר
        # closest_idx = distances.idxmin()
        #
        # # הגיאומטריה שלו (כרגע ב־EPSG:3857)
        # closest_geom = helipads_gdf.loc[closest_idx].geometry
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
        #     f"[DEBUG] Closest helipad found at: "
        #     f"lat={lat_found:.6f}, lon={lon_found:.6f}, "
        #     f"distance={int(round(distances.min()))}m"
        # )


        return int(round(distances.min()))

    # No Helipad found within 15km
    return 0.0
