import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_military_base(lat: float, lon: float) -> float:
    """
    Computes the distance (in meters) to the closest military base
    using progressive search radii: 3km, 6km, 10km.
    Returns 0 if no base is found within 10km.
    """

    search_radii = [3000, 6000, 10000]

    for radius in search_radii:
        try:
            military_gdf = ox.features_from_point(
                (lat, lon),
                tags={"landuse": "military"},
                dist=radius
            )
        except InsufficientResponseError:
            continue

        if military_gdf.empty:
            continue

        # Project to metric CRS
        military_gdf = military_gdf.to_crs(epsg=3857)

        event_point = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        distances = military_gdf.distance(event_point)

        # #מדפיס נצ לבדיקה
        #
        # # האינדקס של השטח הצבאי הקרוב ביותר
        # closest_idx = distances.idxmin()
        #
        # # הגיאומטריה שלו (כרגע ב־EPSG:3857)
        # closest_geom = military_gdf.loc[closest_idx].geometry
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
        #     f"[DEBUG] Closest military area found at: "
        #     f"lat={lat_found:.6f}, lon={lon_found:.6f}, "
        #     f"distance={int(round(distances.min()))}m"
        # )

        return int(round(distances.min()))

    # No Military Base found within 10km
    return 0.0

