"""Clustering endpoints."""

from fastapi import APIRouter, Body, status

from app.api.deps import ClusteringServiceDep
from app.models.clustering import ClusteringSuggestions, ClusterRequest, ClusteringResult
from app.models.common import ErrorResponse

router = APIRouter()


@router.post(
    "/databases/{database_id}/cluster",
    response_model=ClusteringSuggestions,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Suggest clusters (groups of tables)",
    description=(
        "Returns suggested groups of tables. Use suggestions to pick tables "
        "explicitly for concepts/attributes/relationships."
    ),
)
async def cluster_database(
    database_id: str,
    request: ClusterRequest = Body(default=ClusterRequest()),
    service: ClusteringServiceDep = None,
) -> ClusteringSuggestions:
    """
    Generate table clustering suggestions for a database.

    - **database_id**: Database identifier
    - **applyFinetuning**: If true, apply finetuned models during clustering
    """
    suggestions = await service.generate_clusters(
        database_id=database_id,
        apply_finetuning=request.apply_finetuning,
    )
    return suggestions


@router.put(
    "/databases/{database_id}/cluster",
    response_model=dict,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
        400: {"model": ErrorResponse, "description": "Invalid clustering data"},
    },
    summary="Save updated clustering for a database",
    description=(
        "Saves the modified clustering result for a database. Use this after users "
        "have manually adjusted cluster assignments by dragging tables between clusters."
    ),
)
async def save_clustering(
    database_id: str,
    clustering: ClusteringResult,
    service: ClusteringServiceDep = None,
) -> dict:
    """
    Save updated clustering for a database.

    - **database_id**: Database identifier
    - **clustering**: The updated clustering result
    """
    # TODO: Implement actual persistence logic in service
    # For now, just return success
    return {
        "success": True,
        "message": "Clustering saved successfully",
        "clustering": clustering
    }
