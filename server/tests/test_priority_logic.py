import sys
import os

# Adding the project root to sys.path to allow imports from the server package
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Importing the updated function that calculates the capped priority score
from server.src.core.priority_logic import get_final_priority_score


def run_priority_tests():
    """
    Simulation test for the Final Priority Score logic.
    Each scenario demonstrates how GIS features affect the AI damage assessment.
    """
    print("--- Starting Final Priority Score Tests (1.0 Baseline & Capped at 10) ---\n")

    # Scenario 1: High-density urban area (High Priority - Should be capped)
    urban_high_risk = {
        "dist_hospital_m": 800,  # Very close (Bonus)
        "dist_military_base_m": 12000,  # Far (Penalty)
        "dist_school_m": 400,  # Very close (Bonus)
        "dist_roads_m": 150,  #
        "population_density": 13000  # High density (Bonus)
    }

    # Scenario 2: Remote area far from all infrastructure (Low Priority - Should be reduced)
    isolated_area = {
        "dist_hospital_m": 15000,  # Max distance (Penalty)
        "dist_military_base_m": 15000,  # Max distance (Penalty)
        "dist_school_m": 15000,  # Max distance (Penalty)
        "dist_roads_m": 7000,  # Neutral
        "population_density": 200  # Low density (Penalty)
    }

    # Scenario 3: Perfectly neutral urban setting (Should keep the original AI score)
    neutral_area = {
        "dist_hospital_m": 7000,  # Neutral zone
        "dist_military_base_m": 7000,  # Neutral zone
        "dist_school_m": 7000,  # Neutral zone
        "dist_roads_m": 7000,  # Neutral zone
        "population_density": 3000  # Average density
    }

    # Define test cases: (Description, AI Base Damage Score, GIS Data)
    test_scenarios = [
        ("Urban High Risk (Target: Capping at 10.0)", 9.2, urban_high_risk),
        ("Isolated Area (Target: Score Reduction)", 8.5, isolated_area),
        ("Neutral Area (Target: Preserve Original 7.5 Score)", 7.5, neutral_area)
    ]

    for description, ai_score, gis_data in test_scenarios:
        # Calculate the final priority score using the 1.0 + S_total logic
        final_priority_score, raw_mult = get_final_priority_score(ai_score, gis_data)


        print(f"Scenario: {description}")
        print(f"  Input AI Damage Score: {ai_score}")
        print(f"  Calculated Multiplier: {raw_mult}")
        print(f"  Final Priority Score:  {final_priority_score}")

        # English status messages
        if final_priority_score == 10.0 and ai_score * raw_mult > 10:
            print("  Status: Score reached the maximum limit (10.0 Capping applied)")
        elif final_priority_score == ai_score:
            print("  Status: Area is neutral (Original score preserved)")

        print("-" * 60)


if __name__ == "__main__":
    run_priority_tests()