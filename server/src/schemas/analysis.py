"""
Pydantic v2 response schemas for the ``POST /analyze`` endpoint.

The ``/analyze`` endpoint is a legacy test-compatible route that
exposes the raw analysis pipeline output in a shape optimised for
debugging and integration testing, as opposed to the production
``/events`` endpoint which returns the full ``EventResponse`` object.

Classes:
    PrioritySchema:        Score and multiplier sub-object.
    AnalysisDetailsSchema: AI and GIS detail sub-object.
    AnalysisResponse:      Top-level response wrapping both sub-objects.
"""

from pydantic import BaseModel


class PrioritySchema(BaseModel):
    """Priority scoring output sub-object.

    Attributes:
        final_score (float): Clamped priority score in [0.1, 10.0].
            Severity bands: Critical ≥ 7.5 · High ≥ 5.0 ·
            Medium ≥ 2.5 · Low < 2.5.
        geo_multiplier (float): Raw geographic multiplier value used in
            the formula ``damage_score × (1 + geo_multiplier)``.
    """

    final_score:    float
    geo_multiplier: float


class AnalysisDetailsSchema(BaseModel):
    """Detailed analysis sub-object containing AI and GIS outputs.

    Attributes:
        classification (str): AI damage label — ``"Light"`` or
            ``"Heavy"``.
        damage_score (int): Numeric base score — ``3`` (Light) or
            ``7`` (Heavy).
        confidence (float): Model confidence in [0, 1].
        gis_features (dict): Raw GIS feature dictionary as returned by
            the pipeline.  Keys: ``dist_hospital_m``, ``dist_school_m``,
            ``dist_military_base_m``, ``dist_roads_m``,
            ``population_density``.
        explanation (str): Human-readable narrative explaining the score.
    """

    classification: str
    damage_score:   int
    confidence:     float
    gis_features:   dict
    explanation:    str


class AnalysisResponse(BaseModel):
    """Top-level response schema for ``POST /analyze``.

    Wraps both the priority scoring result and the detailed analysis
    breakdown into a single response object.

    Attributes:
        priority (PrioritySchema): Final score and geographic multiplier.
        analysis_details (AnalysisDetailsSchema): AI classification,
            GIS feature values, and the generated explanation narrative.
    """

    priority:         PrioritySchema
    analysis_details: AnalysisDetailsSchema