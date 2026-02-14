import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server.src.services.gis.proximity.closest_school import distance_to_closest_school
from server.src.services.gis.proximity.closest_hospital import distance_to_closest_hospital
from server.src.services.gis.proximity.closest_military_base import distance_to_closest_military_or_helipad
from server.src.services.gis.proximity.closest_road import distance_to_closest_road
from server.src.services.gis.demographics.population_density import get_cbs_population_density


def test_proximity_logic():
    # Test coordinates (Tel Hashomer / Ramat Gan area)
    test_lat, test_lon = 32.0461, 34.8451

    print(f"--- Starting Tests for Lat: {test_lat}, Lon: {test_lon} ---\n")

    # List of services to test (Service name, function)
    services = [
        ("School", distance_to_closest_school),
        ("Hospital", distance_to_closest_hospital),
        ("Military/Helipad", distance_to_closest_military_or_helipad),
        ("Road", distance_to_closest_road)
    ]

    for name, func in services:
        dist, found_lat, found_lon = func(test_lat, test_lon)

        if found_lat is not None:
            print(f"[DEBUG] Closest {name:10} found:")
            print(f"        Distance: {dist}m")
            print(f"        Coordinates: lat={found_lat:.6f}, lon={found_lon:.6f}")

            # Correcting Google Maps link format - using a clean search query
            map_link = f"https://www.google.com/maps/search/?api=1&query={found_lat},{found_lon}"
            print(f"        View on Map: {map_link}")
        else:
            print(f"[DEBUG] {name:10} not found within 15km radius.")

        print("-" * 50)

    # Building density check (this function returns an int only)
    density = get_cbs_population_density(test_lat, test_lon)
    print(f"[DEBUG] Density: {density} people/sqkm.")


if __name__ == "__main__":
    test_proximity_logic()