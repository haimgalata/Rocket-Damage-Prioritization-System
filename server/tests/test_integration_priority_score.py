import sys
import os

# --- Path Setup ---
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Importing Services
from server.src.services.gis.proximity.closest_hospital import distance_to_closest_hospital
from server.src.services.gis.proximity.closest_school import distance_to_closest_school
from server.src.services.gis.proximity.closest_road import distance_to_closest_road
from server.src.services.gis.proximity.closest_military_base import distance_to_closest_military_or_helipad
from server.src.services.gis.demographics.population_density import get_cbs_population_density


# --- Priority Logic ---

def calculate_piecewise_value(distance, r_safe=5000, r_neutral=10000, r_isolated=15000):
    if distance <= r_safe:
        decay_factor = (r_safe - distance) / r_safe
        return round(decay_factor, 3)
    elif r_safe < distance <= r_neutral:
        return 0.0
    elif r_neutral < distance <= r_isolated:
        penalty_decay = - (distance - r_neutral) / (r_isolated - r_neutral)
        return round(penalty_decay, 3)
    else:
        return -1.0  # If distance > 15km


def calculate_density_value(density_val):
    if density_val >= 12000:
        return 1.0
    elif 5000 <= density_val < 12000:
        return round((density_val - 5000) / (12000 - 5000), 3)
    elif 1500 < density_val < 5000:
        return 0.0
    elif 500 <= density_val <= 1500:
        return round(- (1500 - density_val) / (1500 - 500), 3)
    else:
        return -1.0


def get_final_priority_score(damage_score: float, gis_features: dict):
    """
    As defined in your logic: Multiplier = 1.0 + Sum(Wi * Ci)
    """
    weights = {
        "dist_hospital_m": 0.25,
        "strategic": 0.25,  # Combined Military & Helipad
        "dist_school_m": 0.15,
        "dist_roads_m": 0.15,
        "population_density": 0.20
    }

    s_total = 0.0
    for feature, value in gis_features.items():
        if feature in weights:
            if feature == "population_density":
                c_i = calculate_density_value(value)
            else:
                c_i = calculate_piecewise_value(value)
            s_total += weights[feature] * c_i

    # The Logic: Multiplier starts at 1.0 and increases/decreases based on S
    raw_multiplier = round(1.0 + s_total, 3)

    # Priority Score = Damage * (1 + S)
    raw_priority_score = damage_score * raw_multiplier
    final_score = round(min(10.0, max(0.1, raw_priority_score)), 3)

    return final_score, raw_multiplier


# --- Integration Test ---

def run_integration_test():
    print("--- Running Integration Test (Corrected Formula) ---")
    lat, lon = 32.0461, 34.8451  # Sheba Medical Center

    # Fetch Data
    dist_h, _, _ = distance_to_closest_hospital(lat, lon)
    dist_st, _, _ = distance_to_closest_military_or_helipad(lat, lon)
    dist_s, _, _ = distance_to_closest_school(lat, lon)
    dist_r, _, _ = distance_to_closest_road(lat, lon)
    density = get_cbs_population_density(lat, lon)

    features = {
        "dist_hospital_m": dist_h,
        "strategic": dist_st,
        "dist_school_m": dist_s,
        "dist_roads_m": dist_r,
        "population_density": density
    }

    damage_input = 8.5
    final_score, multiplier = get_final_priority_score(damage_input, features)

    print(f"\nResults for Location ({lat}, {lon}):")
    print(f" - Multiplier (1 + S): {multiplier}")
    print(f" - AI Damage: {damage_input}")
    print(f" - FINAL PRIORITY SCORE: {final_score}")

    if final_score >= 10.0:
        print("\n✅ SUCCESS: Priority capped at 10.0 due to high strategic importance.")


if __name__ == "__main__":
    run_integration_test()