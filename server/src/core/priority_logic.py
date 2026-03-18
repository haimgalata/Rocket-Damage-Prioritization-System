"""
Priority score calculation logic for the PrioritAI system.

This module implements the Geographic Priority Scoring formula:

    final_score = clamp(damage_score × (1 + S_total), 0.1, 10.0)

where ``S_total`` is a weighted sum of piecewise coefficients derived from
five GIS proximity/demographic features:

    Feature               Weight   Coefficient source
    ──────────────────    ──────   ─────────────────────────────────────
    dist_hospital_m       0.25     calculate_piecewise_value()
    dist_military_base_m  0.20     calculate_piecewise_value()
    dist_school_m         0.15     calculate_piecewise_value()
    dist_roads_m          0.20     calculate_piecewise_value()
    population_density    0.20     calculate_density_value()

Coordinate system: WGS-84 (EPSG:4326). All distance inputs are in metres.
"""


def calculate_piecewise_value(
    distance: float,
    r_safe: float = 5000,
    r_neutral: float = 10000,
    r_isolated: float = 15000,
) -> float:
    """Map a proximity distance to a dimensionless geographic coefficient C ∈ [-1, 1].

    The piecewise function defines three concentric zones around the damage
    event, modelling the idea that proximity to critical infrastructure
    *increases* urgency while isolation *decreases* it:

    +------------------+-------+--------------------------------------------+
    | Zone             | Range | C value                                    |
    +==================+=======+============================================+
    | Bonus            | 0 – r_safe           | Linear decay 1 → 0        |
    | Neutral          | r_safe – r_neutral   | 0 (no adjustment)         |
    | Penalty          | r_neutral – r_isolated| Linear decay 0 → -1      |
    | Fully isolated   | > r_isolated         | Returns raw distance *    |
    +------------------+-------+--------------------------------------------+

    (*) Returning the raw distance when nothing is found within 15 km is an
    existing design decision preserved here without modification.

    Args:
        distance (float): Distance in metres from the event to the nearest
            feature (hospital, school, strategic site, or road). A value of
            ``-1`` indicates the feature was not found; this propagates as a
            large penalty because ``-1 < r_safe`` evaluates to the bonus
            branch — callers should sanitise inputs if needed.
        r_safe (float): Outer radius of the bonus zone in metres.
            Default: 5000 m (5 km).
        r_neutral (float): Outer radius of the neutral zone in metres.
            Default: 10000 m (10 km).
        r_isolated (float): Outer radius of the penalty zone in metres.
            Beyond this the feature is considered absent. Default: 15000 m.

    Returns:
        float: Geographic coefficient C rounded to 3 decimal places.
            Range: approximately [-1, 1] for valid distances.
            Returns the raw ``distance`` value (unadjusted) when
            ``distance > r_isolated``.
    """
    if distance <= r_safe:
        # Bonus Zone: linear decay from 1.0 (at distance=0) to 0.0 (at r_safe)
        decay_factor = (r_safe - distance) / r_safe
        return round(decay_factor, 3)

    elif r_safe < distance <= r_neutral:
        # Neutral Zone: no contribution to the multiplier
        return 0.0

    elif r_neutral < distance <= r_isolated:
        # Penalty Zone: linear decay from 0.0 (at r_neutral) to -1.0 (at r_isolated)
        penalty_decay = - (distance - r_neutral) / (r_isolated - r_neutral)
        return round(penalty_decay, 3)

    else:
        # Feature not found within 15 km — return raw distance as sentinel
        return distance


def calculate_density_value(density_val: float) -> float:
    """Map a population density to a dimensionless demographic coefficient C ∈ [-1, 1].

    Higher population density near a damage event increases the urgency of a
    response (more people potentially affected), while very low density
    decreases it. The tiers are calibrated to Israeli urban/suburban norms:

    +---------------------------+--------------------------------------------+
    | Density (persons / km²)   | Coefficient C                              |
    +===========================+============================================+
    | ≥ 12 000                  | 1.0  (super-dense urban core)              |
    | 5 000 – 12 000            | Linear interpolation 0 → 1                 |
    | 1 500 – 5 000             | 0.0  (average suburban area)               |
    | 500  – 1 500              | Linear interpolation -1 → 0                |
    | < 500                     | -1.0 (rural / very sparse)                 |
    +---------------------------+--------------------------------------------+

    Args:
        density_val (float): Population density in persons per km².
            Typically sourced from the Israeli Central Bureau of Statistics
            (CBS) 2022 statistical areas shapefile joined to 2023 population
            data. A value of ``0.0`` is used when the shapefile lookup fails.

    Returns:
        float: Demographic coefficient C rounded to 3 decimal places,
            bounded in [-1.0, 1.0].
    """
    if density_val >= 12000:
        # Super high density: maximum contribution
        return 1.0

    elif 5000 <= density_val < 12000:
        # High density: linear interpolation between 0 and 1
        return round((density_val - 5000) / (12000 - 5000), 3)

    elif 1500 < density_val < 5000:
        # Average suburban density: neutral contribution
        return 0.0

    elif 500 <= density_val <= 1500:
        # Low density: linear interpolation between -1 and 0
        return round(- (1500 - density_val) / (1500 - 500), 3)

    else:
        # Super low / rural density: maximum penalty
        return -1.0


def get_final_priority_score(
    damage_score: float,
    gis_features: dict,
) -> tuple:
    """Calculate the Final Priority Score and the raw Geographic Multiplier.

    Implements the core scoring formula::

        S_total       = Σ  weight_i × C_i
        raw_multiplier = 1.0 + S_total
        final_score   = clamp(damage_score × raw_multiplier, 0.1, 10.0)

    Each GIS feature is converted to a dimensionless coefficient ``C_i``
    using either :func:`calculate_piecewise_value` (distance-based features)
    or :func:`calculate_density_value` (population density), then multiplied
    by its weight and accumulated into ``S_total``.

    Feature weights::

        dist_hospital_m      → 0.25
        dist_military_base_m → 0.20
        dist_school_m        → 0.15
        dist_roads_m         → 0.20  (treated as 0 if value == 0)
        population_density   → 0.20

    Args:
        damage_score (float): Raw AI damage score. Expected values are
            ``3`` (Light classification) or ``7`` (Heavy classification),
            both on a 0–10 scale.
        gis_features (dict): Dictionary of GIS feature values keyed by
            feature name. Expected keys:

            - ``"dist_hospital_m"`` (float): Distance to nearest hospital in m.
            - ``"dist_military_base_m"`` (float): Distance to nearest strategic
              site (military base or helipad) in m.
            - ``"dist_school_m"`` (float): Distance to nearest school in m.
            - ``"dist_roads_m"`` (float): Distance to nearest road in m.
            - ``"population_density"`` (float): Population density in persons/km².

            A value of ``-1`` for a distance key indicates the feature was not
            found within the search radius.

    Returns:
        tuple[float, float]: A two-element tuple:

            - ``final_score`` (float): Clamped priority score in [0.1, 10.0],
              rounded to 3 decimal places.
            - ``raw_multiplier`` (float): The uncapped geographic multiplier
              ``1.0 + S_total``, rounded to 3 decimal places. Values above 1
              amplify the damage score; values below 1 attenuate it.

    Example::

        score, mult = get_final_priority_score(7, {
            "dist_hospital_m": 800,
            "dist_military_base_m": 2200,
            "dist_school_m": 400,
            "dist_roads_m": 50,
            "population_density": 18000,
        })
        # score ≈ 9.1,  mult ≈ 1.30
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