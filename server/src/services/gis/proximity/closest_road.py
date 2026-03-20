"""Nearest-road proximity service."""

import logging

import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError
from server.src.services.gis.proximity.osm_query import features_from_point as osm_features_from_point

ox.settings.timeout = 25
ox.settings.use_cache = True
logger = logging.getLogger(__name__)


def distance_to_closest_road(lat: float, lon: float):
    """Compute the straight-line distance to the nearest road of any type.

    Returns (distance_m, found_lat, found_lon) or -1 if not found within 15 km.
    """
    road_tags = {
        "highway": [
            "motorway", "trunk", "primary", "secondary",
            "tertiary", "residential", "unclassified", "service"
        ]
    }

    search_radii = [2000, 15000]

    for radius in search_radii:
        try:
            roads_gdf = osm_features_from_point(
                (lat, lon),
                tags=road_tags,
                dist=radius
            )
        except InsufficientResponseError:
            logger.debug(f"[GIS:road] No features at radius={radius}m for ({lat},{lon})")
            continue
        except Exception as exc:
            logger.error(f"[GIS:road] OSM query failed at radius={radius}m for ({lat},{lon}): {type(exc).__name__}: {exc}")
            continue

        if roads_gdf.empty:
            continue

        roads_gdf_metric = roads_gdf.to_crs(epsg=3857)

        event_point_metric = gpd.GeoSeries(
            [Point(lon, lat)],
            crs="EPSG:4326"
        ).to_crs(epsg=3857).iloc[0]

        distances = roads_gdf_metric.distance(event_point_metric)

        closest_idx = distances.idxmin()
        closest_geom = roads_gdf.loc[closest_idx].geometry

        found_lon, found_lat = closest_geom.centroid.coords[0]

        return int(round(distances.min())), found_lat, found_lon

    return -1
