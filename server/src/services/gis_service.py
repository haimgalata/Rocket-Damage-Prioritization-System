"""GIS service layer — thin wrapper over the GIS pipeline."""

from server.src.services.gis.gis_pipeline import extract_gis_features


def get_gis_features(lat: float, lon: float) -> dict:
    """Extract all GIS features for a geographic coordinate."""
    return extract_gis_features(lat, lon)
