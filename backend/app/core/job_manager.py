"""
Job manager for tracking async operations
"""
import uuid
from datetime import datetime
from typing import Dict, Optional, Any, Callable, Coroutine
import asyncio
from app.models.job import Job, JobStatus, JobType, JobProgress


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
        return self._jobs.get(job_id)
    
    def update_progress(self, job_id: str, current: int, total: int, message: Optional[str] = None):
        """Update job progress"""
        job = self._jobs.get(job_id)
        if not job:
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
            return
        
        job.status = JobStatus.COMPLETED
        job.result = result
        job.progress = JobProgress(current=100, total=100, percentage=100.0, message="Completed")
        job.updatedAt = datetime.utcnow()
        job.completedAt = datetime.utcnow()
        
        # Clean up task
        if job_id in self._tasks:
            del self._tasks[job_id]
    
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
                return
            
            job.status = JobStatus.RUNNING
            job.updatedAt = datetime.utcnow()
            
            # Execute the task
            result = await task_func(*args, **kwargs)
            
            # Mark as completed
            self.complete_job(job_id, result)
            
        except Exception as e:
            # Mark as failed
            self.fail_job(job_id, str(e))
    
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
