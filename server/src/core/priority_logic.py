"""Priority score calculation logic for the PrioritAI system.

Formula: final_score = clamp(damage_score × (1 + S_total), 0.1, 10.0)
where S_total is a weighted sum of piecewise coefficients from five GIS features.
"""


def calculate_piecewise_value(
    distance: float,
    r_safe: float = 5000,
    r_neutral: float = 10000,
    r_isolated: float = 15000,
) -> float:
    """Map a proximity distance to a geographic coefficient C ∈ [-1, 1]."""
    if distance == -1 or distance is None:
        return -1.0

    if distance <= r_safe:
        return round((r_safe - distance) / r_safe, 3)

    elif r_safe < distance <= r_neutral:
        return 0.0

    elif r_neutral < distance <= r_isolated:
        return round(-(distance - r_neutral) / (r_isolated - r_neutral), 3)

    else:
        return -1.0


def calculate_density_value(density_val: float) -> float:
    """Map a population density to a demographic coefficient C ∈ [-1, 1]."""
    if density_val >= 12000:
        return 1.0

    elif 5000 <= density_val < 12000:
        return round((density_val - 5000) / (12000 - 5000), 3)

    elif 1500 < density_val < 5000:
        return 0.0

    elif 500 <= density_val <= 1500:
        return round(-(1500 - density_val) / (1500 - 500), 3)

    else:
        return -1.0


def get_final_priority_score(
    damage_score: float,
    gis_features: dict,
) -> tuple:
    """Calculate the Final Priority Score and the raw Geographic Multiplier.

    Returns tuple[float, float]: (final_score, raw_multiplier).
    """
    weights = {
        "dist_hospital_m": 0.25,
        "dist_military_base_m": 0.20,
        "dist_school_m": 0.15,
        "dist_roads_m": 0.20,
        "population_density": 0.20,
    }

    s_total = 0.0

    for feature, value in gis_features.items():
        if feature in weights:
            if feature == "population_density":
                c_i = calculate_density_value(value)
            else:
                c_i = calculate_piecewise_value(value)

            s_total += weights[feature] * c_i

    raw_multiplier = round(1.0 + s_total, 3)
    final_score = round(min(10.0, max(0.1, damage_score * raw_multiplier)), 3)

    return final_score, raw_multiplier
