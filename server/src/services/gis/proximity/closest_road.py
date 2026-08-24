"""Nearest-road proximity service."""

import logging
import time

import geopandas as gpd
from shapely.geometry import Point
from osmnx._errors import InsufficientResponseError
from server.src.services.gis.proximity.osm_query import features_from_point as osm_features_from_point

logger = logging.getLogger(__name__)


def distance_to_closest_road(lat: float, lon: float, deadline: float | None = None):
    """Compute the straight-line distance to the nearest road of any type.

    `deadline` is an absolute `time.monotonic()` timestamp; once reached, no further
    search radius is attempted (see osm_query.features_from_point for how a single
    radius's own network attempts are bounded by the same deadline).

    Returns (distance_m, found_lat, found_lon) or -1 if not found within 15 km, or
    if the deadline was reached before a match could be confirmed.
    """
    road_tags = {
        "highway": [
            "motorway", "trunk", "primary", "secondary",
            "tertiary", "residential", "unclassified", "service"
        ]
    }

    search_radii = [2000, 15000]

    for radius in search_radii:
        if deadline is not None and time.monotonic() >= deadline:
            logger.warning(f"[GIS:road] Deadline reached before radius={radius}m for ({lat},{lon})")
            break
        try:
            roads_gdf = osm_features_from_point(
                (lat, lon),
                tags=road_tags,
                dist=radius,
                deadline=deadline,
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
