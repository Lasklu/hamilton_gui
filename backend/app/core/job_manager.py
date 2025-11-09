"""
Job manager for tracking async operations
"""
import uuid
from datetime import datetime
from typing import Dict, Optional, Any, Callable, Coroutine
import asyncio
import traceback
from app.models.job import Job, JobStatus, JobType, JobProgress
from app.core.logging import get_logger

logger = get_logger(__name__)


class JobManager:
    """Manages background jobs and their state"""
    
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
    
    def create_job(self, job_type: JobType, database_id: str, parameters: Optional[Dict[str, Any]] = None) -> Job:
        """Create a new job"""
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        
        job = Job(
            id=job_id,
            type=job_type,
            status=JobStatus.PENDING,
            databaseId=database_id,
            progress=None,
            result=None,
            error=None,
            createdAt=now,
            updatedAt=now,
            completedAt=None
        )
        
        self._jobs[job_id] = job
        return job
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        job = self._jobs.get(job_id)
        if job:
            logger.debug(f"get_job({job_id}): status={job.status}, progress={job.progress}")
        return job
    
    def update_progress(self, job_id: str, current: int, total: int, message: Optional[str] = None):
        """Update job progress"""
        job = self._jobs.get(job_id)
        if not job:
            return
        
        # Don't update progress if job is already completed or failed
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
            logger.debug(f"Skipping progress update for {job_id} - job already {job.status}")
            return
        
        percentage = (current / total * 100) if total > 0 else 0
        job.progress = JobProgress(
            current=current,
            total=total,
            percentage=round(percentage, 2),
            message=message
        )
        job.status = JobStatus.RUNNING
        job.updatedAt = datetime.utcnow()
    
    def complete_job(self, job_id: str, result: Any):
        """Mark job as completed with result"""
        job = self._jobs.get(job_id)
        if not job:
            logger.warning(f"complete_job called for non-existent job: {job_id}")
            return
        
        logger.info(f"Marking job {job_id} as COMPLETED")
        job.status = JobStatus.COMPLETED
        job.result = result
        job.progress = JobProgress(current=100, total=100, percentage=100.0, message="Completed")
        job.updatedAt = datetime.utcnow()
        job.completedAt = datetime.utcnow()
        
        # Clean up task
        if job_id in self._tasks:
            del self._tasks[job_id]
        
        logger.info(f"Job {job_id} marked as COMPLETED with result type: {type(result).__name__}")
    
    def fail_job(self, job_id: str, error: str):
        """Mark job as failed with error"""
        job = self._jobs.get(job_id)
        if not job:
            return
        
        job.status = JobStatus.FAILED
        job.error = error
        job.updatedAt = datetime.utcnow()
        job.completedAt = datetime.utcnow()
        
        # Clean up task
        if job_id in self._tasks:
            del self._tasks[job_id]
    
    async def execute_job(
        self,
        job_id: str,
        task_func: Callable[..., Coroutine[Any, Any, Any]],
        *args,
        **kwargs
    ):
        """Execute a job asynchronously"""
        try:
            job = self._jobs.get(job_id)
            if not job:
                logger.warning(f"execute_job called for non-existent job: {job_id}")
                return
            
            logger.info(f"Starting execution of job {job_id}")
            job.status = JobStatus.RUNNING
            job.updatedAt = datetime.utcnow()
            
            # Execute the task
            logger.info(f"Calling task function for job {job_id}")
            result = await task_func(*args, **kwargs)
            logger.info(f"Task function completed for job {job_id}, result type: {type(result).__name__}")
            
            # Mark as completed
            self.complete_job(job_id, result)
            
        except Exception as e:
            # Log full traceback for debugging
            logger.exception(f"Job {job_id} failed with exception: {str(e)}")
            # Mark as failed with full traceback
            error_message = f"{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
            self.fail_job(job_id, error_message)
    
    def start_job(
        self,
        job_id: str,
        task_func: Callable[..., Coroutine[Any, Any, Any]],
        *args,
        **kwargs
    ) -> asyncio.Task:
        """Start a background job"""
        task = asyncio.create_task(self.execute_job(job_id, task_func, *args, **kwargs))
        self._tasks[job_id] = task
        return task
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove old completed/failed jobs"""
        now = datetime.utcnow()
        to_remove = []
        
        for job_id, job in self._jobs.items():
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                if job.completedAt:
                    age = (now - job.completedAt).total_seconds() / 3600
                    if age > max_age_hours:
                        to_remove.append(job_id)
        
        for job_id in to_remove:
            del self._jobs[job_id]


# Global job manager instance
job_manager = JobManager()
