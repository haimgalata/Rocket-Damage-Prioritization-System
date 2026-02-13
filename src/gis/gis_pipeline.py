from gis.proximity.closest_school import distance_to_closest_school
from gis.proximity.closest_hospital import distance_to_closest_hospital
from gis.proximity.closest_military_base import distance_to_closest_military_base
from gis.proximity.closest_helipad import distance_to_closest_helipad
from gis.demographics.population_density import building_density_online

def extract_gis_features(lat: float, lon: float) -> dict:
    """
    Extracts geographic proximity features for a given point.
    Currently includes:
    - Distance to closest school
    """

    features = {}

    features["dist_school_m"] = distance_to_closest_school(lat, lon)
    features["dist_hospital_m"] = distance_to_closest_hospital(lat, lon)
    features["dist_military_base_m"] = distance_to_closest_military_base(lat, lon)
    features["dist_helipad_m"] = distance_to_closest_helipad(lat, lon)
    features["residential_buildings_500m"] = building_density_online(lat, lon)

    return features
