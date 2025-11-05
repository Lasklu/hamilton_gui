"""Dependency injection for API endpoints."""

from typing import Annotated
from fastapi import Depends

from app.services.database_service import DatabaseService
from app.services.clustering_service import ClusteringService
from app.services.ontology_service import OntologyService


# Service instances (singleton pattern)
# In production, consider using a proper DI container
_database_service: DatabaseService | None = None
_clustering_service: ClusteringService | None = None
_ontology_service: OntologyService | None = None


def get_database_service() -> DatabaseService:
    """Get database service instance."""
    global _database_service
    if _database_service is None:
        _database_service = DatabaseService()
    return _database_service


def get_clustering_service() -> ClusteringService:
    """Get clustering service instance."""
    global _clustering_service
    if _clustering_service is None:
        _clustering_service = ClusteringService()
    return _clustering_service


def get_ontology_service() -> OntologyService:
    """Get ontology service instance."""
    global _ontology_service
    if _ontology_service is None:
        _ontology_service = OntologyService()
    return _ontology_service


# Type aliases for dependency injection
DatabaseServiceDep = Annotated[DatabaseService, Depends(get_database_service)]
ClusteringServiceDep = Annotated[ClusteringService, Depends(get_clustering_service)]
OntologyServiceDep = Annotated[OntologyService, Depends(get_ontology_service)]
