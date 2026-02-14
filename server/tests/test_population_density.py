import sys
import os

# --- Path Setup ---
# Setting up root path to allow imports from the project structure
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, ".."))
if project_root not in sys.path:
    sys.path.append(project_root)

# Import the actual density service from your GIS module
from server.src.services.gis.demographics.population_density import get_cbs_population_density


def calculate_density_value(density_val):
    """
    Normalizes population density (people/km2) to a Ci value.
    Tiers: Critical (12k+), Urban (5k-12k), Base (1.5k-5k), Rural (0.5k-1.5k), Isolated (<0.5k)
    """
    if density_val >= 12000:
        return 1.0
    elif density_val >= 5000:
        return round((density_val - 5000) / (12000 - 5000), 3)
    elif density_val > 1500:
        return 0.0
    elif density_val >= 500:
        return round(- (1500 - density_val) / (1500 - 500), 3)
    else:
        return -1.0


def run_density_unit_test():
    print("--- Testing Population Density Logic & Data Mapping ---")

    # Coordinates for testing (Ramat Gan / Tel Aviv Area)
    test_lat, test_lon = 32.0461, 34.8451

    # 1. Fetch raw data using the service
    raw_density = get_cbs_population_density(test_lat, test_lon)

    # 2. Calculate the normalized model value (Ci)
    ci_score = calculate_density_value(raw_density)

    print(f"Location: Lat {test_lat}, Lon {test_lon}")
    print(f"Raw Density: {raw_density} residents/sqkm")
    print(f"Model Score (Ci): {ci_score}")

    # 3. Status Validation
    if raw_density < 0:
        print("\nSTATUS: FAILED - Check Excel/SHP mapping or coordinates.")


if __name__ == "__main__":
    run_density_unit_test()