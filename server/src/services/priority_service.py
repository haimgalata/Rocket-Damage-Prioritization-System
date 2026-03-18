"""
Priority service layer — wraps :mod:`server.src.core.priority_logic`.

Provides two public functions:

- :func:`compute_priority` — delegates to the core scoring formula and
  returns the clamped final score plus the raw geographic multiplier.
- :func:`build_explanation` — constructs a human-readable narrative
  describing the AI classification, GIS context, and score derivation,
  suitable for inclusion in the event ``llmExplanation`` field.
"""

from server.src.core.priority_logic import get_final_priority_score


def compute_priority(damage_score: int, gis_features: dict) -> tuple[float, float]:
    """Compute the final priority score and raw geographic multiplier.

    Delegates to
    :func:`~server.src.core.priority_logic.get_final_priority_score`,
    which applies the weighted GIS formula and clamps the result to
    the [0.1, 10.0] scale.

    Args:
        damage_score (int): Base damage score from AI classification.
            Expected values: ``3`` (Light) or ``7`` (Heavy).
        gis_features (dict): Feature dictionary produced by the GIS
            pipeline.  Expected keys: ``dist_hospital_m``,
            ``dist_school_m``, ``dist_military_base_m``,
            ``dist_roads_m``, ``population_density``.

    Returns:
        tuple[float, float]: A two-element tuple:

            - ``final_score`` (float): Clamped priority score in the
              range [0.1, 10.0].
            - ``geo_multiplier`` (float): Raw sum of GIS sub-scores
              used in the formula ``damage_score × (1 + multiplier)``.
    """
    return get_final_priority_score(damage_score, gis_features)


def build_explanation(
    classification: str,
    damage_score: int,
    gis_features: dict,
    final_score: float,
    multiplier: float,
) -> str:
    """Generate a human-readable explanation of the priority score.

    Produces a single narrative paragraph combining the AI
    classification label, GIS proximity distances, population density,
    geographic multiplier, and final score with its severity label.
    The output is stored in the event ``llmExplanation`` field and
    displayed to operators in the dashboard.

    Args:
        classification (str): Damage severity label from the AI model —
            ``"Light"`` or ``"Heavy"``.
        damage_score (int): Numeric base score — ``3`` for Light,
            ``7`` for Heavy.
        gis_features (dict): GIS feature dictionary with keys
            ``dist_hospital_m``, ``dist_school_m``, ``dist_roads_m``,
            ``dist_military_base_m``, and ``population_density``.
            Missing keys default to ``-1`` (distances) or ``0``
            (density).
        final_score (float): Clamped priority score in [0.1, 10.0].
        multiplier (float): Raw geographic multiplier value.

    Returns:
        str: A single-paragraph explanation string. Severity labels:
            ``"critical"`` for score ≥ 7.5, ``"high"`` for ≥ 5.0,
            ``"moderate"`` otherwise. Distances are formatted as
            ``"X.X km"`` for values ≥ 1000 m or ``"X m"`` for shorter
            distances, and ``"not found within 15 km"`` for ``-1``.
    """

    def fmt_m(v: float) -> str:
        if v < 0:
            return "not found within 15 km"
        return f"{v / 1000:.1f} km" if v >= 1000 else f"{int(v)} m"

    severity = "critical" if final_score >= 7.5 else "high" if final_score >= 5.0 else "moderate"
    density  = int(gis_features.get("population_density", 0))

    return (
        f"{classification} damage classification detected by vision AI model. "
        f"Structural characteristics are consistent with {classification.lower()} damage patterns — "
        f"{'immediate structural assessment recommended.' if classification == 'Heavy' else 'standard repair scheduling is appropriate.'} "
        f"Geographic context: "
        f"nearest hospital {fmt_m(gis_features.get('dist_hospital_m', -1))}, "
        f"nearest school {fmt_m(gis_features.get('dist_school_m', -1))}, "
        f"nearest road {fmt_m(gis_features.get('dist_roads_m', -1))}, "
        f"nearest strategic site {fmt_m(gis_features.get('dist_military_base_m', -1))}, "
        f"population density {density:,} persons/km². "
        f"Geographic multiplier: \u00d7{multiplier:.2f}. "
        f"Final priority score: {final_score:.1f}/10 ({severity} priority). "
        f"Score formula: damage({damage_score}) \u00d7 geo_multiplier({multiplier:.2f}) = {final_score:.1f}."
    )