"""Clustering-related models."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.common import TableRef


class ClusteringGroup(BaseModel):
    """A group of related tables."""

    label: Optional[str] = Field(None, description="Human-readable label")
    tables: List[TableRef] = Field(..., description="Tables in this cluster")
    scores: Optional[Dict[str, float]] = Field(
        None, description="Clustering metrics"
    )


class ClusteringSuggestions(BaseModel):
    """Clustering suggestions for a database."""

    database_id: str = Field(..., alias="databaseId", description="Database ID")
    created_at: datetime = Field(..., alias="createdAt", description="Timestamp")
    applied_finetuning: Optional[bool] = Field(
        None,
        alias="appliedFinetuning",
        description="Whether finetuning was applied",
    )
    groups: List[ClusteringGroup] = Field(..., description="Cluster groups")

    class Config:
        populate_by_name = True


class ClusterRequest(BaseModel):
    """Request model for clustering operation."""

    apply_finetuning: bool = Field(
        False,
        alias="applyFinetuning",
        description="Apply finetuned models during clustering",
    )

    class Config:
        populate_by_name = True


class ClusterInfo(BaseModel):
    """Information about a single cluster."""

    cluster_id: int = Field(..., alias="clusterId", description="Unique cluster ID")
    name: str = Field(..., description="Cluster name/label")
    description: Optional[str] = Field(None, description="Cluster description")
    tables: List[str] = Field(..., description="List of table names in this cluster")
    confidence: Optional[float] = Field(
        None, description="Confidence score (0-1)", ge=0, le=1
    )

    class Config:
        populate_by_name = True


class ClusteringResult(BaseModel):
    """Result of clustering operation with simplified structure."""

    database_id: str = Field(..., alias="databaseId", description="Database ID")
    clusters: List[ClusterInfo] = Field(..., description="List of identified clusters")
    created_at: datetime = Field(..., alias="createdAt", description="Timestamp")

    class Config:
        populate_by_name = True


class SaveClusteringRequest(BaseModel):
    """Request model for saving a clustering."""

    name: str = Field(..., description="User-friendly name for this clustering")
    clustering: ClusteringResult = Field(..., description="The clustering result to save")

    class Config:
        populate_by_name = True

