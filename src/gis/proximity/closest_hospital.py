import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError


def distance_to_closest_hospital(lat: float, lon: float) -> float:
    """
    Computes the distance (in meters) to the closest hospital
    using progressive search radii: 2km, 4km, 6km.
    Returns 0 if no hospital is found within 6km.
    """

    search_radii = [2000, 4000, 6000]

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
        hospitals_gdf = hospitals_gdf.to_crs(epsg=3857)

        # Event point in same CRS
        event_point = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        distances = hospitals_gdf.distance(event_point)

        #מדפיס נצ לבדיקה
        # # האינדקס של בית החולים הקרוב ביותר
        # closest_idx = distances.idxmin()
        #
        # # הגיאומטריה שלו (כרגע ב־EPSG:3857)
        # closest_geom = hospitals_gdf.loc[closest_idx].geometry
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
        #     f"[DEBUG] Closest hospital found at: "
        #     f"lat={lat_found:.6f}, lon={lon_found:.6f}, "
        #     f"distance={int(round(distances.min()))}m"
        # )



        return int(round(distances).min())

    # No hospital found within 6km
    return 0.0
