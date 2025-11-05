"""Ontology-related models."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.common import (
    ConditionJSON,
    IDAttributeSet,
    JoinJSON,
    TableRef,
)


class ConceptJSON(BaseModel):
    """
    Concept definition compatible with parse_concept.
    Recursive structure for sub-concepts and concept representations.
    """

    id_attributes: Optional[List[IDAttributeSet]] = Field(
        None, alias="idAttributes", description="Identifying attributes"
    )
    attributes: Optional[List[Dict[str, str]]] = Field(
        None, description="Data attributes"
    )
    joins: Optional[List[JoinJSON]] = Field(None, description="Join specifications")
    sub_concepts: Optional[List["ConceptJSON"]] = Field(
        None, alias="subConcepts", description="Nested sub-concepts"
    )
    conditions: Optional[List[ConditionJSON]] = Field(
        None, description="Filter conditions"
    )
    concept_representations: Optional[List["ConceptJSON"]] = Field(
        None, alias="conceptRepresentations", description="Alternative representations"
    )

    class Config:
        populate_by_name = True


# Enable forward references for recursive models
ConceptJSON.model_rebuild()


class ObjectPropertyJSON(BaseModel):
    """Relationship between two concepts."""

    concept1: Dict[str, Any] = Field(
        ..., description="First concept (with id_attributes)"
    )
    concept2: Dict[str, Any] = Field(
        ..., description="Second concept (with id_attributes)"
    )
    joins: List[JoinJSON] = Field(..., description="Join specifications")


class ScopedRequest(BaseModel):
    """Base request with database scope and tables."""

    database_id: str = Field(..., alias="databaseId", description="Database ID")
    tables: List[TableRef] = Field(
        ..., min_length=1, description="Tables to consider"
    )
    modeling_hints: Optional[Dict[str, Any]] = Field(
        None,
        alias="modelingHints",
        description="Optional hints (domain, aliases, constraints)",
    )

    class Config:
        populate_by_name = True


class AttributesRequest(ScopedRequest):
    """Request for generating/augmenting attributes."""

    concept: ConceptJSON = Field(
        ..., description="Seed concept to be augmented with attributes"
    )


class AttributeInfo(BaseModel):
    """Attribute information for relationships request."""

    concept_id: int | str = Field(..., alias="conceptId", description="Concept index or label")
    name: str = Field(..., description="Attribute name")
    source_columns: List[Dict[str, str]] = Field(
        ..., alias="sourceColumns", description="Source columns (schema, table, column)"
    )

    class Config:
        populate_by_name = True


class ConceptIdentifier(BaseModel):
    """Minimal concept identifier using id_attributes."""

    id_attributes: List[IDAttributeSet] = Field(
        ..., alias="idAttributes", description="Identifying attributes"
    )

    class Config:
        populate_by_name = True


class RelationshipsRequest(ScopedRequest):
    """Request for generating relationships."""

    concepts: List[ConceptIdentifier] = Field(
        ..., min_length=2, description="Concepts identified by id_attributes"
    )
    attributes: List[AttributeInfo] = Field(
        ..., description="Known attributes for the concepts"
    )
    modeling_hints: Optional[Dict[str, Any]] = Field(
        None,
        alias="modelingHints",
        description="Optional hints (cardinalities, FK conventions)",
    )


class ConceptWithLikelihood(BaseModel):
    """Concept with associated likelihood score."""

    concept: ConceptJSON = Field(..., description="Generated concept")
    likelihood: float = Field(
        ..., ge=0.0, le=1.0, description="Likelihood score [0,1]"
    )


class ObjectPropertyWithLikelihood(BaseModel):
    """Object property with associated likelihood score."""

    object_property: ObjectPropertyJSON = Field(
        ..., alias="objectProperty", description="Generated relationship"
    )
    likelihood: float = Field(
        ..., ge=0.0, le=1.0, description="Likelihood score [0,1]"
    )

    class Config:
        populate_by_name = True
