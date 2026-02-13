def calculate_piecewise_value(distance, r_safe=5000, r_neutral=10000, r_isolated=15000):
    """
    Translates physical distance (meters) into a pricing value between -1.0 and 1.0.
    
    Logic:
    - 0 to 5km: Positive bonus (decreases as distance increases).
    - 5km to 10km: Neutral (0.0).
    - 10km to 15km: Partial penalty (-0.5).
    - Above 15km: Maximum penalty (-1.0).
    """
    # If distance is 0, it means no feature was found within the search radius (Isolated)
    if distance == 0:
        return -1.0
        
    if distance <= r_safe:
        # Bonus: Decreases by 0.03 for every 100 meters away from the source
        steps = (r_safe - distance) / 100
        return min(1.0, steps * 0.03)
    
    elif r_safe < distance <= r_neutral:
        # Neutral zone: No impact on priority
        return 0.0
    
    elif r_neutral < distance <= r_isolated:
        # Partial negative penalty
        return -0.5
    
    else:
        # Maximum negative penalty for isolated locations
        return -1.0

def get_final_priority_multiplier(gis_features: dict) -> float:
    """
    Calculates the final priority multiplier (1 + Phi) based on GIS proximity features.
    Accepts the features dictionary from extract_gis_features.
    """
    # Weight configuration (Sum of weights must equal 1.0)
    weights = {
        "dist_hospital_m": 0.25,
        "dist_military_base_m": 0.20,
        "dist_school_m": 0.15,
        "dist_helipad_m": 0.20,
        "dist_roads_m": 0.10,      # Placeholder for road proximity
        "population_density": 0.10  # Placeholder for density score (-1 to 1)
    }

    phi = 0.0
    
    # Iterate through all extracted GIS features
    for feature_name, value in gis_features.items():
        if feature_name in weights:
            # For density, we assume the value is already normalized between -1 and 1
            if feature_name == "population_density":
                phi += weights[feature_name] * value
            else:
                # For distance-based features, calculate the piecewise value
                criterion_val = calculate_piecewise_value(value)
                phi += weights[feature_name] * criterion_val

    # Final Multiplier formula: 1 + Sum(Weight_i * Criterion_i)
    # Range: 0.0 (low priority) to 2.0 (double priority)
    multiplier = 1 + phi
    
    # Ensure the multiplier is not negative and round to 3 decimal places
    return round(max(0.0, multiplier), 3)