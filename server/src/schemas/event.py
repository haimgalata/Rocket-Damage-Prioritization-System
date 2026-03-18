"""
Pydantic v2 request/response schemas for the ``POST /events`` endpoint.

Classes:
    GisDetailsSchema: Nested GIS proximity and density measurements.
    LocationSchema:   Geographic location of the damage event.
    EventResponse:    Full event object returned after creation.

All field names use camelCase to match the TypeScript frontend
``DamageEvent`` interface directly without additional serialisation
aliases.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GisDetailsSchema(BaseModel):
    """GIS-derived proximity and demographic measurements for an event.

    All distance fields default to ``-1`` to signal "not found within
    the maximum search radius".  ``geoMultiplier`` defaults to ``1.0``
    (neutral — no adjustment) so that a failed GIS pipeline does not
    artificially inflate or deflate the priority score.

    Attributes:
        distHospitalM (float): Straight-line distance in metres to the
            nearest hospital (``amenity=hospital``). ``-1`` if not found
            within 15 km.
        distSchoolM (float): Straight-line distance in metres to the
            nearest school (``amenity=school``). ``-1`` if not found
            within 15 km.
        distRoadM (float): Straight-line distance in metres to the
            nearest road segment (common ``highway`` tags). ``-1`` if
            not found within 15 km.
        distStrategicM (float): Straight-line distance in metres to
            the nearest military base (``landuse=military``) or helipad
            (``aeroway=helipad``). ``-1`` if not found within 15 km.
        populationDensity (float): Population density at the event
            location in persons per km² (Israeli CBS data). ``0`` on
            failure or when the point falls outside all known
            statistical areas.
        geoMultiplier (float): Raw geographic multiplier applied to the
            damage score.  Encodes the combined effect of all GIS
            sub-scores.  ``1.0`` is neutral; values above 1.0 increase
            priority, below decrease it.
    """

    distHospitalM:     float = Field(-1,  description="Distance to nearest hospital (m)")
    distSchoolM:       float = Field(-1,  description="Distance to nearest school (m)")
    distRoadM:         float = Field(-1,  description="Distance to nearest road (m)")
    distStrategicM:    float = Field(-1,  description="Distance to nearest strategic site (m)")
    populationDensity: float = Field(0,   description="Population density (persons/km²)")
    geoMultiplier:     float = Field(1.0, description="Geographic priority multiplier")


class LocationSchema(BaseModel):
    """Geographic location of a damage event.

    Attributes:
        lat (float): WGS-84 latitude in decimal degrees.
        lng (float): WGS-84 longitude in decimal degrees.
        address (str): Human-readable address string.  Falls back to a
            ``"GPS <lat>, <lon>"`` string when a real address is
            unavailable.
        city (str): City or locality name derived from the address.
    """

    lat:     float
    lng:     float
    address: str
    city:    str


class EventResponse(BaseModel):
    """Full damage event object returned by ``POST /events``.

    This schema mirrors the TypeScript ``DamageEvent`` interface so that
    the frontend can consume the response without transformation.

    Attributes:
        id (str): Unique event identifier, formatted as
            ``"evt-<8-char hex>"``.
        organizationId (str): Identifier of the organisation that
            submitted the event.
        createdBy (str): Identifier of the user who submitted the event.
        description (str): Free-text description provided at submission.
        location (LocationSchema): Geographic location of the event.
        imageUrl (str): URL of the uploaded damage image.  Empty string
            when no image was provided.
        damageClassification (str): AI damage label — ``"Light"`` or
            ``"Heavy"``.
        damageScore (int): Numeric base score — ``3`` (Light) or
            ``7`` (Heavy).
        priorityScore (float): Final clamped priority score in [0.1, 10.0].
        gisDetails (GisDetailsSchema): GIS proximity and demographic
            measurements at the event location.
        status (str): Workflow status of the event.  Initial value is
            ``"pending"``.
        hidden (bool): Whether the event is hidden from operator views.
            Initial value is ``False``.
        llmExplanation (str): Human-readable narrative explaining the
            priority score, produced by
            :func:`~server.src.services.priority_service.build_explanation`.
        aiModel (str): Name of the AI model that produced the
            classification (e.g. ``"PrioritAI-v2.1"``).
        tags (list[str]): Optional list of user-supplied tag strings.
        createdAt (str): ISO-8601 timestamp (UTC) of event creation,
            e.g. ``"2024-06-01T12:34:56.789Z"``.
    """

    id:                   str
    organizationId:       str
    createdBy:            str
    description:          str
    location:             LocationSchema
    imageUrl:             str
    damageClassification: str
    damageScore:          int
    priorityScore:        float
    gisDetails:           GisDetailsSchema
    status:               str
    hidden:               bool
    llmExplanation:       str
    aiModel:              str
    tags:                 list[str]
    createdAt:            str