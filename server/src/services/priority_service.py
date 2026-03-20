"""Priority service layer — wraps priority_logic and builds score explanations."""

from server.src.core.priority_logic import get_final_priority_score


def compute_priority(damage_score: int, gis_features: dict) -> tuple[float, float]:
    """Compute the final priority score and raw geographic multiplier."""
    return get_final_priority_score(damage_score, gis_features)


def build_explanation(
    classification: str,
    damage_score: int,
    gis_features: dict,
    final_score: float,
    multiplier: float,
) -> str:
    """Generate a human-readable explanation of the priority score."""

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
