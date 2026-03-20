"""Pydantic v2 request/response schemas for the POST /events endpoint."""

from typing import Optional
from pydantic import BaseModel, Field


class GisDetailsSchema(BaseModel):
    """GIS-derived proximity and demographic measurements for an event."""

    distHospitalM:     float = Field(-1,  description="Distance to nearest hospital (m)")
    distSchoolM:       float = Field(-1,  description="Distance to nearest school (m)")
    distRoadM:         float = Field(-1,  description="Distance to nearest road (m)")
    distStrategicM:    float = Field(-1,  description="Distance to nearest strategic site (m)")
    populationDensity: float = Field(0,   description="Population density (persons/km²)")
    geoMultiplier:     float = Field(1.0, description="Geographic priority multiplier")


class LocationSchema(BaseModel):
    """Geographic location of a damage event."""

    lat:     float
    lng:     float
    address: str
    city:    str


class EventResponse(BaseModel):
    """Full damage event object returned by POST /events."""

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
    gisStatus:            str = Field("done", description="'pending' while GIS runs, 'done' when complete")
    status:               str
    hidden:               bool
    llmExplanation:       str
    aiModel:              str
    tags:                 list[str]
    createdAt:            str
