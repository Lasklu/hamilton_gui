"""
Job models for async operations
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Status of a background job"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    """Type of background job"""
    CLUSTERING = "clustering"
    CONCEPTS = "concepts"
    ATTRIBUTES = "attributes"
    RELATIONSHIPS = "relationships"


class JobCreate(BaseModel):
    """Request to create a new job"""
    type: JobType
    databaseId: str
    parameters: Optional[Dict[str, Any]] = None


class JobProgress(BaseModel):
    """Progress information for a job"""
    current: int = Field(ge=0, description="Current progress value")
    total: int = Field(ge=1, description="Total progress value")
    percentage: float = Field(ge=0, le=100, description="Progress percentage")
    message: Optional[str] = Field(None, description="Current status message")


class Job(BaseModel):
    """Job response model"""
    id: str
    type: JobType
    status: JobStatus
    databaseId: str
    progress: Optional[JobProgress] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    completedAt: Optional[datetime] = None


class JobStatusResponse(BaseModel):
    """Response for job status check"""
    id: str
    type: JobType
    status: JobStatus
    progress: Optional[JobProgress] = None
    result: Optional[Any] = None
    error: Optional[str] = None
