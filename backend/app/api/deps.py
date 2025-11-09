"""Dependency injection for API endpoints."""

from typing import Annotated
from fastapi import Depends

from app.services.database_service import DatabaseService
from app.services.clustering_service import ClusteringService
from app.services.ontology_service import OntologyService
from app.db.session import get_db
from sqlalchemy.orm import Session


def get_database_service(db: Session = Depends(get_db)) -> DatabaseService:
    """Get database service instance with database session."""
    return DatabaseService(db)


def get_clustering_service() -> ClusteringService:
    """Get clustering service instance."""
    return ClusteringService()


def get_ontology_service() -> OntologyService:
    """Get ontology service instance."""
    return OntologyService()


# Type aliases for dependency injection
DatabaseServiceDep = Annotated[DatabaseService, Depends(get_database_service)]
ClusteringServiceDep = Annotated[ClusteringService, Depends(get_clustering_service)]
OntologyServiceDep = Annotated[OntologyService, Depends(get_ontology_service)]
