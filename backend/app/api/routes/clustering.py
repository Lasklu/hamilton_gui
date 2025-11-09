"""Clustering endpoints."""

import asyncio
from typing import List
from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ClusteringServiceDep, get_db
from app.models.clustering import ClusteringSuggestions, ClusterRequest, ClusteringResult, SaveClusteringRequest
from app.models.common import ErrorResponse
from app.models.job import JobType, JobCreateResponse
from app.core.job_manager import job_manager
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post(
    "/databases/{database_id}/cluster",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Start clustering job (async)",
    description=(
        "Starts a background job to cluster tables. Returns immediately with a job ID. "
        "Use GET /jobs/{jobId} to check progress and retrieve results."
    ),
)
async def cluster_database(
    database_id: str,
    request: ClusterRequest = Body(default=ClusterRequest()),
    service: ClusteringServiceDep = None,
) -> JobCreateResponse:
    """
    Start a clustering job for a database.

    - **database_id**: Database identifier
    - **applyFinetuning**: If true, apply finetuned models during clustering
    """
    # Create job
    job = job_manager.create_job(
        job_type=JobType.CLUSTERING,
        database_id=database_id,
        parameters={"apply_finetuning": request.apply_finetuning}
    )
    
    # Start background task
    async def run_clustering():
        """Background task to run clustering"""
        try:
            # Define progress callback that updates the job manager
            def progress_callback(current: int, total: int, message: str):
                """Callback for execute_schuyler to report progress"""
                job_manager.update_progress(job.id, current, total, message)
            
            # Run actual clustering with progress callback
            # The progress_callback will be called from execute_schuyler as it progresses
            suggestions = await service.generate_clusters(
                database_id=database_id,
                apply_finetuning=request.apply_finetuning,
                progress_callback=progress_callback
            )
            
            # Final completion update (in case execute_schuyler doesn't report 100%)
            job_manager.update_progress(job.id, 100, 100, "Clustering completed!")
            
            return suggestions
        except Exception as e:
            # Log full exception with traceback
            logger.exception(f"Clustering job {job.id} failed for database {database_id}: {str(e)}")
            # Re-raise so job_manager.execute_job marks it as failed with full traceback
            raise
    
    # Start the job
    job_manager.start_job(job.id, run_clustering)
    
    return JobCreateResponse(jobId=job.id)


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
    request: SaveClusteringRequest,
    service: ClusteringServiceDep = None,
    db: Session = Depends(get_db)
) -> dict:
    """
    Save updated clustering for a database.

    - **database_id**: Database identifier
    - **request**: Contains the clustering result and name
    """
    clustering_id = await service.save_clustering(
        db=db,
        database_id=database_id,
        clustering_result=request.clustering,
        name=request.name,
        applied_finetuning=False,  # TODO: Track this from the original clustering request
        set_active=True
    )
    
    return {
        "success": True,
        "message": "Clustering saved successfully",
        "clusteringId": clustering_id
    }


@router.get(
    "/databases/{database_id}/cluster/saved",
    response_model=List[dict],
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="List all saved clusterings for a database",
    description="Retrieves a list of all saved clustering results for a specific database.",
)
async def list_saved_clusterings(
    database_id: str,
    service: ClusteringServiceDep = None,
    db: Session = Depends(get_db)
) -> List[dict]:
    """
    List all saved clusterings for a database.

    - **database_id**: Database identifier
    
    Returns a list of clustering summaries with id, name, cluster count, and timestamps.
    """
    return await service.list_clusterings(db=db, database_id=database_id)


@router.get(
    "/databases/{database_id}/cluster/saved/{clustering_id}",
    response_model=ClusteringResult,
    responses={
        404: {"model": ErrorResponse, "description": "Clustering not found"},
    },
    summary="Load a specific saved clustering",
    description="Retrieves the details of a previously saved clustering result.",
)
async def get_saved_clustering(
    database_id: str,
    clustering_id: int,
    service: ClusteringServiceDep = None,
    db: Session = Depends(get_db)
) -> ClusteringResult:
    """
    Load a saved clustering result.

    - **database_id**: Database identifier (for validation)
    - **clustering_id**: ID of the saved clustering to load
    """
    return await service.get_clustering(db=db, clustering_id=clustering_id)


@router.get(
    "/databases/{database_id}/cluster/active",
    response_model=ClusteringResult | None,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Get the active clustering for a database",
    description="Retrieves the currently active clustering result for a database, if one exists.",
)
async def get_active_clustering(
    database_id: str,
    service: ClusteringServiceDep = None,
    db: Session = Depends(get_db)
) -> ClusteringResult | None:
    """
    Get the active clustering for a database.

    - **database_id**: Database identifier
    
    Returns the active clustering or None if no clustering is active.
    """
    return await service.get_active_clustering(db=db, database_id=database_id)


@router.put(
    "/databases/{database_id}/cluster/saved/{clustering_id}/activate",
    response_model=dict,
    responses={
        404: {"model": ErrorResponse, "description": "Clustering not found"},
    },
    summary="Set a clustering as the active one",
    description="Activates a saved clustering and deactivates all others for the database.",
)
async def activate_clustering(
    database_id: str,
    clustering_id: int,
    service: ClusteringServiceDep = None,
    db: Session = Depends(get_db)
) -> dict:
    """
    Set a clustering as active.

    - **database_id**: Database identifier (for validation)
    - **clustering_id**: ID of the clustering to activate
    """
    await service.set_active_clustering(db=db, clustering_id=clustering_id)
    
    return {
        "success": True,
        "message": f"Clustering {clustering_id} is now active"
    }
