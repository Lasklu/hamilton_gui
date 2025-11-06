"""Relationship data models."""

from pydantic import BaseModel, Field
from typing import Optional


class Relationship(BaseModel):
    """Model for a relationship between two concepts."""
    
    id: str = Field(..., description="Unique identifier for the relationship")
    fromConceptId: str = Field(..., alias="fromConceptId", description="Source concept ID")
    toConceptId: str = Field(..., alias="toConceptId", description="Target concept ID")
    name: Optional[str] = Field(None, description="Name/label of the relationship")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Confidence score (0-1)")
    
    class Config:
        populate_by_name = True


class RelationshipConfirmRequest(BaseModel):
    """Request model for confirming relationships."""
    
    relationships: list[Relationship] = Field(..., description="List of relationships to confirm")
