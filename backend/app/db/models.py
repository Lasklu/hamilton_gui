"""SQLAlchemy models for metadata database."""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, JSON, Text, Enum as SQLEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import enum


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class DatabaseProvider(str, enum.Enum):
    """Supported database providers."""
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    SQLSERVER = "sqlserver"
    ORACLE = "oracle"


class DatabaseStatus(str, enum.Enum):
    """Database connection status."""
    PENDING = "pending"
    CONNECTED = "connected"
    FAILED = "failed"
    DISCONNECTED = "disconnected"


class JobType(str, enum.Enum):
    """Background job types."""
    CLUSTERING = "clustering"
    CONCEPTS = "concepts"
    ATTRIBUTES = "attributes"


class JobStatus(str, enum.Enum):
    """Background job status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class DatabaseMetadata(Base):
    """Metadata for registered databases."""
    __tablename__ = "databases"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(SQLEnum(DatabaseProvider), nullable=False)
    
    # Connection information
    host: Mapped[Optional[str]] = mapped_column(String(255))
    port: Mapped[Optional[int]] = mapped_column(Integer)
    database_name: Mapped[Optional[str]] = mapped_column(String(255))
    username: Mapped[Optional[str]] = mapped_column(String(255))
    password: Mapped[Optional[str]] = mapped_column(String(255))  # Should be encrypted
    connection_string: Mapped[Optional[str]] = mapped_column(Text)
    
    # Metadata
    status: Mapped[str] = mapped_column(SQLEnum(DatabaseStatus), default=DatabaseStatus.PENDING)
    table_count: Mapped[int] = mapped_column(Integer, default=0)
    schema_json: Mapped[Optional[str]] = mapped_column(JSON)  # Stores full schema
    sql_content: Mapped[Optional[str]] = mapped_column(Text)  # Original SQL if uploaded
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Additional metadata
    description: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(JSON)


class ClusteringResult(Base):
    """Clustering results for databases."""
    __tablename__ = "clustering_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    database_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Clustering metadata
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # User-friendly name
    algorithm: Mapped[str] = mapped_column(String(50), default="schuyler")
    parameters: Mapped[Optional[str]] = mapped_column(JSON)
    applied_finetuning: Mapped[bool] = mapped_column(default=False)
    
    # Results
    cluster_count: Mapped[int] = mapped_column(Integer)
    clusters: Mapped[str] = mapped_column(JSON)  # Array of ClusterInfo objects
    
    # Flags
    is_active: Mapped[bool] = mapped_column(default=True)  # Current active clustering
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Concept(Base):
    """Business concepts identified from database schema."""
    __tablename__ = "concepts"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    database_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    cluster_id: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Concept details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Concept definition
    id_attributes: Mapped[Optional[str]] = mapped_column(JSON)
    conditions: Mapped[Optional[str]] = mapped_column(JSON)
    joins: Mapped[Optional[str]] = mapped_column(JSON)
    
    # Metadata
    confirmed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Attribute(Base):
    """Attributes for concepts."""
    __tablename__ = "attributes"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    concept_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    # Attribute details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    column: Mapped[Optional[str]] = mapped_column(String(255))
    table: Mapped[Optional[str]] = mapped_column(String(255))
    data_type: Mapped[str] = mapped_column(String(50))
    
    # Configuration
    is_required: Mapped[bool] = mapped_column(default=False)
    static_value: Mapped[Optional[str]] = mapped_column(Text)
    joins: Mapped[Optional[str]] = mapped_column(JSON)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Relationship(Base):
    """Relationships between concepts."""
    __tablename__ = "relationships"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    database_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Relationship details
    from_concept_id: Mapped[str] = mapped_column(String(100), nullable=False)
    to_concept_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    confidence: Mapped[Optional[float]] = mapped_column()
    
    # Metadata
    confirmed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Job(Base):
    """Background jobs for async operations."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    database_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Job details
    type: Mapped[str] = mapped_column(SQLEnum(JobType), nullable=False)
    status: Mapped[str] = mapped_column(SQLEnum(JobStatus), default=JobStatus.PENDING)
    
    # Progress tracking
    progress_current: Mapped[int] = mapped_column(Integer, default=0)
    progress_total: Mapped[int] = mapped_column(Integer, default=100)
    progress_message: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Results and errors
    result: Mapped[Optional[str]] = mapped_column(JSON)
    error: Mapped[Optional[str]] = mapped_column(Text)
    
    # Parameters
    parameters: Mapped[Optional[str]] = mapped_column(JSON)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
