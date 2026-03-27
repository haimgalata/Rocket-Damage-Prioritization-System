"""
Schemas package — Pydantic v2 request/response models.

Re-exports all public schema classes so that route handlers and tests
can import directly from ``server.src.schemas`` without referencing
individual sub-modules.

Exports:
    Event schemas:
        EventResponse:      Full event object (``POST /events``).
        GisDetailsSchema:   GIS proximity and density sub-object.
        LocationSchema:     Geographic location sub-object.

    Analysis schemas:
        AnalysisResponse:      Top-level response (``POST /analyze``).
        PrioritySchema:        Score and multiplier sub-object.
        AnalysisDetailsSchema: AI and GIS detail sub-object.
"""

from .event import EventResponse, GisDetailsSchema, LocationSchema
from .analysis import AnalysisResponse, PrioritySchema, AnalysisDetailsSchema