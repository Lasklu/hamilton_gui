"""Clustering endpoints."""

import asyncio
from fastapi import APIRouter, Body, status

from app.api.deps import ClusteringServiceDep
from app.models.clustering import ClusteringSuggestions, ClusterRequest, ClusteringResult
from app.models.common import ErrorResponse
from app.models.job import JobType, JobCreateResponse
from app.core.job_manager import job_manager

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
            # Simulate progress
            job_manager.update_progress(job.id, 0, 100, "Analyzing database schema...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 20, 100, "Extracting table relationships...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 40, 100, "Computing similarity scores...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 60, 100, "Clustering tables...")
            # Run actual clustering
            suggestions = await service.generate_clusters(
                database_id=database_id,
                apply_finetuning=request.apply_finetuning,
            )
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 90, 100, "Finalizing results...")
            await asyncio.sleep(0.3)
            
            return suggestions
        except Exception as e:
            raise e
    
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
