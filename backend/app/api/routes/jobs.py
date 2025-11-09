"""
Job management routes
"""
from fastapi import APIRouter, HTTPException
from app.models.job import JobStatusResponse
from app.core.job_manager import job_manager
from app.core.logging import get_logger

router = APIRouter(prefix="/jobs", tags=["Jobs"])
logger = get_logger(__name__)


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the status of a background job"""
    job = job_manager.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    logger.info(f"API returning job {job_id} with status: {job.status}, progress: {job.progress}")
    
    return JobStatusResponse(
        id=job.id,
        type=job.type,
        status=job.status,
        progress=job.progress,
        result=job.result,
        error=job.error
    )
