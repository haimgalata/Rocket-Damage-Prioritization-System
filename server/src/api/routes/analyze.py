"""
Analysis route — ``POST /analyze``.

Legacy test-compatible endpoint that runs the same AI + GIS + priority
pipeline as ``POST /events`` but returns the raw analysis shape defined
by :class:`~server.src.schemas.analysis.AnalysisResponse`.

Use cases:

- Integration and unit tests that assert on raw pipeline outputs.
- Manual inspection of GIS feature values and intermediate scores.
- Clients that need the full ``gis_features`` dict without the
  assembled ``EventResponse`` envelope.

Unlike ``POST /events``, this endpoint requires an image upload and
does not accept optional metadata fields (``organization_id``,
``created_by``, ``tags``, ``description``).
"""

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from server.src.schemas.analysis import AnalysisResponse
from server.src.services.ai_service import run_classification
from server.src.services.gis_service import get_gis_features
from server.src.services.priority_service import compute_priority, build_explanation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("", response_model=AnalysisResponse)
async def analyze(
    lat:   float      = Form(...),
    lon:   float      = Form(...),
    image: UploadFile = File(...),
) -> AnalysisResponse:
    """Run the full damage-analysis pipeline and return raw outputs.

    Accepts a ``multipart/form-data`` request with coordinates and an
    image, then executes the same three-stage pipeline used by
    ``POST /events``:

    1. **AI classification** — CNN inference on the uploaded image.
    2. **GIS extraction** — OSM proximity queries + CBS population
       density lookup.
    3. **Priority scoring** — weighted GIS formula producing the final
       clamped score and explanation narrative.

    Args:
        lat (float): WGS-84 latitude of the damage event.
            Required ``multipart/form-data`` field.
        lon (float): WGS-84 longitude of the damage event.
            Required ``multipart/form-data`` field.
        image (UploadFile): Damage photo upload (required).
            Supported formats: JPEG, PNG, WebP.

    Returns:
        AnalysisResponse: Nested response containing:

            - ``priority.final_score`` (float): Clamped score in
              [0.1, 10.0].
            - ``priority.geo_multiplier`` (float): Raw GIS multiplier.
            - ``analysis_details.classification`` (str): ``"Light"``
              or ``"Heavy"``.
            - ``analysis_details.damage_score`` (int): ``3`` or ``7``.
            - ``analysis_details.confidence`` (float): Model confidence.
            - ``analysis_details.gis_features`` (dict): Full GIS
              feature dictionary.
            - ``analysis_details.explanation`` (str): Narrative
              explanation of the priority score.

    Raises:
        HTTPException: Status ``500`` if any unhandled exception
            propagates from the pipeline stages.
    """
    try:
        image_bytes = await image.read()

        ai_result    = run_classification(image_bytes)
        gis_features = get_gis_features(lat, lon)
        final_score, multiplier = compute_priority(ai_result["damage_score"], gis_features)
        explanation  = build_explanation(
            ai_result["classification"], ai_result["damage_score"],
            gis_features, final_score, multiplier,
        )

        return {
            "priority": {
                "final_score":    final_score,
                "geo_multiplier": multiplier,
            },
            "analysis_details": {
                "classification": ai_result["classification"],
                "damage_score":   ai_result["damage_score"],
                "confidence":     ai_result["confidence"],
                "gis_features":   gis_features,
                "explanation":    explanation,
            },
        }

    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=str(e))