
def calculate_piecewise_value(distance, r_safe=5000, r_neutral=10000, r_isolated=15000):

    if distance <= r_safe:
        # r_safe: Bonus Zone
        decay_factor = (r_safe - distance) / r_safe
        return round(decay_factor, 3)

    elif r_safe < distance <= r_neutral:
        # r_safe to r_neutral: Neutral Zone C = 0
        return 0.0

    elif r_neutral < distance <= r_isolated:
        # r_neutral to r_isolated: Penalty Zone 0 < C < -1
        penalty_decay = - (distance - r_neutral) / (r_isolated - r_neutral)
        return round(penalty_decay, 3)

    else:
        # if there is nothing in 15km C = -1
        return distance



def calculate_density_value(density_val):

    if density_val >= 12000:
        # Super high density: C = 1
        return 1.0

    elif 5000 <= density_val < 12000:
        # high density: 0 < C < 1
        return round((density_val - 5000) / (12000 - 5000), 3)

    elif 1500 < density_val < 5000:
        # average density: C = 0
        return 0.0

    elif 500 <= density_val <= 1500:
        # low density: -1 < C < 0
        return round(- (1500 - density_val) / (1500 - 500), 3)

    else:
        # super low density
        return -1.0


def get_final_priority_score(damage_score: float, gis_features: dict):
    """
    Calculates the Final Priority Score and the Raw Multiplier.
    Returns: (final_score, raw_multiplier)
    """
    weights = {
        "dist_hospital_m": 0.25,
        "dist_military_base_m": 0.20,
        "dist_school_m": 0.15,
        "dist_roads_m": 0.20,
        "population_density": 0.20
    }

    s_total = 0.0

    for feature, value in gis_features.items():
        if feature in weights:
            # Neutralize roads logic if value is 0 (placeholder)
            if feature == "dist_roads_m" and value == 0:
                c_i = 0.0
            elif feature == "population_density":
                c_i = calculate_density_value(value)
            else:
                c_i = calculate_piecewise_value(value)

            s_total += weights[feature] * c_i

    # The raw spatial multiplier before capping
    raw_multiplier = round(1.0 + s_total, 3)

    # Calculate score and apply the 10.0 cap
    raw_priority_score = damage_score * raw_multiplier
    final_score = round(min(10.0, max(0.1, raw_priority_score)), 3)

    return final_score, raw_multiplier