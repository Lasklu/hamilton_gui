"""Common models shared across multiple endpoints."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error response model."""

    error: str = Field(..., description="Error code/type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional error details"
    )


class TableRef(BaseModel):
    """Reference to a database table."""

    schema_: str = Field(..., alias="schema", description="Schema name")
    name: str = Field(..., description="Table name")

    class Config:
        populate_by_name = True


class IDAttributeSet(BaseModel):
    """Set of attributes that identify a concept."""

    attributes: List[Dict[str, str]] = Field(
        ..., min_length=1, description="List of {table, column} pairs"
    )


class JoinSide(BaseModel):
    """One side of a join condition."""

    table: str = Field(..., description="Table name")
    columns: List[str] = Field(..., min_length=1, description="Column names")


class JoinJSON(BaseModel):
    """Join specification between two tables."""

    left: JoinSide
    right: JoinSide


class ConditionJSON(BaseModel):
    """Filter condition for concept refinement."""

    operator: str = Field(
        ...,
        description="Comparison operator",
        pattern="^(EQUALS|NOT_EQUALS|LESS_THAN|LESS_THAN_EQUALS|GREATER_THAN|GREATER_THAN_EQUALS)$",
    )
    value: Any = Field(..., description="Comparison value")
    table: str = Field(..., description="Table name")
    column: str = Field(..., description="Column name")
