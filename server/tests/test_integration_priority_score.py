import sys
import os

# --- Path Setup ---
# מוודא שהפרויקט נמצא ב-Python Path כדי למנוע ModuleNotFoundError
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Importing Services
try:
    from server.src.services.gis.proximity.closest_hospital import distance_to_closest_hospital
    from server.src.services.gis.proximity.closest_school import distance_to_closest_school
    from server.src.services.gis.proximity.closest_road import distance_to_closest_road
    from server.src.services.gis.proximity.closest_military_base import distance_to_closest_military_or_helipad
    from server.src.services.gis.demographics.population_density import get_cbs_population_density
except ImportError as e:
    print(f"❌ Error importing services: {e}")
    print("Ensure you are running from the project root using: python -m server.tests.test_integration_priority_score")
    sys.exit(1)


# --- Helper Function for Unpacking ---
def safe_get_distance(func, lat, lon):
    """
    מטפל בבעיה שחלק מהפונקציות מחזירות ערך אחד וחלק שלושה.
    """
    result = func(lat, lon)
    if isinstance(result, (tuple, list)):
        return result[0]  # מחזיר רק את המרחק (הערך הראשון)
    return result  # מחזיר את הערך כפי שהוא אם הוא מספר


# --- Priority Logic ---

def calculate_piecewise_value(distance, r_safe=5000, r_neutral=10000, r_isolated=15000):
    if distance == -1 or distance is None: return 0.0
    if distance <= r_safe:
        decay_factor = (r_safe - distance) / r_safe
        return round(decay_factor, 3)
    elif r_safe < distance <= r_neutral:
        return 0.0
    elif r_neutral < distance <= r_isolated:
        penalty_decay = - (distance - r_neutral) / (r_isolated - r_neutral)
        return round(penalty_decay, 3)
    else:
        return -1.0


def calculate_density_value(density_val):
    if density_val == -1 or density_val is None: return 0.0
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
    weights = {
        "dist_hospital_m": 0.25,
        "strategic": 0.25,
        "dist_school_m": 0.15,
        "dist_roads_m": 0.15,
        "population_density": 0.20
    }

    s_total = 0.0
    for feature, value in gis_features.items():
        if feature in weights:
            c_i = calculate_density_value(value) if feature == "population_density" else calculate_piecewise_value(
                value)
            s_total += weights[feature] * c_i

    raw_multiplier = round(1.0 + s_total, 3)
    raw_priority_score = damage_score * raw_multiplier
    final_score = round(min(10.0, max(0.1, raw_priority_score)), 3)

    return final_score, raw_multiplier


# --- Integration Test ---

def run_integration_test():
    print("\n" + "=" * 50)
    print("--- Running Integration Test (Safe Unpacking) ---")
    print("=" * 50)

    # מיקום דגימה (שיבא תל השומר)
    lat, lon = 30.91580, 34.95670

    # Fetch Data בשימוש בפונקציית העזר כדי למנוע את ה-TypeError
    dist_h = safe_get_distance(distance_to_closest_hospital, lat, lon)
    dist_st = safe_get_distance(distance_to_closest_military_or_helipad, lat, lon)
    dist_s = safe_get_distance(distance_to_closest_school, lat, lon)
    dist_r = safe_get_distance(distance_to_closest_road, lat, lon)
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

    print(f"\n📍 Location Check ({lat}, {lon}) - Area: Tel Hashomer")
    print("-" * 30)
    for k, v in features.items():
        print(f" 📊 {k:20}: {v}")

    print("-" * 30)
    print(f" 🚀 Damage Input: {damage_input}")
    print(f" ✖️ Calculated Multiplier: {multiplier}")
    print(f" 🏆 FINAL PRIORITY SCORE: {final_score}")
    print("-" * 30)

    if final_score >= 10.0:
        print("\n✅ SUCCESS: Priority reached maximum (10.0).")
    else:
        print(f"\nℹ️ TEST COMPLETE: Final score is {final_score}")


if __name__ == "__main__":
    run_integration_test()