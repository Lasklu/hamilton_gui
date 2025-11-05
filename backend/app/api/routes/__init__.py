"""API route modules."""

from fastapi import APIRouter
from app.api.routes import databases, clustering, ontology, jobs, mock

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(
    databases.router,
    prefix="/databases",
    tags=["Databases"],
)

api_router.include_router(
    clustering.router,
    tags=["Clustering"],
)

api_router.include_router(
    ontology.router,
    prefix="/ontology",
    tags=["Ontology"],
)

api_router.include_router(
    jobs.router,
    tags=["Jobs"],
)

# Include mock router for testing
api_router.include_router(
    mock.router,
    tags=["Mock"],
)
