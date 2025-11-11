"""
Data models for concept generation and management.
"""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class ConceptAttribute(BaseModel):
    """Reference to a table column"""
    table: str = Field(..., description="Table name")
    column: str = Field(..., description="Column name")
    name: Optional[str] = Field(None, description="Human-readable name for the attribute")

    class Config:
        populate_by_name = True


class ConceptIDAttribute(BaseModel):
    """Group of attributes that form an identifier"""
    attributes: List[ConceptAttribute] = Field(..., description="List of columns that form an ID")

    class Config:
        populate_by_name = True


class ConceptCondition(BaseModel):
    """A condition that defines or filters a concept"""
    table: str = Field(..., description="Table name")
    column: str = Field(..., description="Column name")
    operator: str = Field(..., description="Comparison operator (e.g., EQUALS, NOT_EQUALS, GREATER_THAN, etc.)")
    value: str = Field(..., description="Value to compare against")

    class Config:
        populate_by_name = True


class Concept(BaseModel):
    """A concept extracted from database tables"""
    id: Optional[str] = Field(None, description="Unique identifier for the concept")
    name: Optional[str] = Field(None, description="Human-readable name for the concept")
    cluster_id: Optional[int] = Field(None, description="ID of the cluster this concept belongs to", alias="clusterId")
    id_attributes: List[ConceptIDAttribute] = Field(..., description="ID attributes that uniquely identify this concept", alias="idAttributes")
    attributes: Optional[List[ConceptAttribute]] = Field(None, description="Additional attributes of the concept")
    confidence: Optional[float] = Field(None, description="Confidence score for this concept (0-1)")
    sub_concepts: Optional[List['Concept']] = Field(default=None, description="Sub-concepts nested within this concept", alias="subConcepts")
    conditions: Optional[List[ConceptCondition]] = Field(default=None, description="Conditions that define this concept")
    joins: Optional[List[str]] = Field(default=None, description="Join definitions for this concept")

    class Config:
        populate_by_name = True


# Update forward reference for recursive model
Concept.model_rebuild()


class ConceptSuggestion(BaseModel):
    """Suggested concepts for a cluster"""
    concepts: List[Concept] = Field(..., description="List of suggested concepts")

    class Config:
        populate_by_name = True


class ClusterConceptsRequest(BaseModel):
    """Request to generate concepts for a cluster"""
    cluster_id: int = Field(..., description="ID of the cluster", alias="clusterId")

    class Config:
        populate_by_name = True
