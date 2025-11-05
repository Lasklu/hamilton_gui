"""
Data models for concept generation and management.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ConceptAttribute(BaseModel):
    """Reference to a table column"""
    table: str = Field(..., description="Table name")
    column: str = Field(..., description="Column name")


class ConceptIDAttribute(BaseModel):
    """Group of attributes that form an identifier"""
    attributes: list[ConceptAttribute] = Field(..., description="List of columns that form an ID")


class Concept(BaseModel):
    """A concept extracted from database tables"""
    id: str = Field(..., description="Unique identifier for the concept")
    name: Optional[str] = Field(None, description="Human-readable name for the concept")
    clusterId: int = Field(..., description="ID of the cluster this concept belongs to", alias="clusterId")
    idAttributes: list[ConceptIDAttribute] = Field(..., description="ID attributes that uniquely identify this concept", alias="idAttributes")
    attributes: Optional[list[ConceptAttribute]] = Field(None, description="Additional attributes of the concept")
    confidence: Optional[float] = Field(None, description="Confidence score for this concept (0-1)")
    subConcepts: Optional[list['Concept']] = Field(default=None, description="Sub-concepts nested within this concept", alias="subConcepts")
    conditions: Optional[list[str]] = Field(default=None, description="Conditions that define this concept")
    joins: Optional[list[str]] = Field(default=None, description="Join definitions for this concept")

    class Config:
        populate_by_name = True


# Update forward reference for recursive model
Concept.model_rebuild()


class ConceptSuggestion(BaseModel):
    """Suggested concepts for a cluster"""
    concepts: list[Concept] = Field(..., description="List of suggested concepts")


class ClusterConceptsRequest(BaseModel):
    """Request to generate concepts for a cluster"""
    clusterId: int = Field(..., description="ID of the cluster", alias="clusterId")

    class Config:
        populate_by_name = True
