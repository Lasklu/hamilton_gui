"""Ontology generation endpoints."""

import asyncio
from typing import List, Union
from fastapi import APIRouter, Body, Query, status

from app.api.deps import OntologyServiceDep
from app.models.ontology import (
    AttributesRequest,
    ConceptJSON,
    ConceptWithLikelihood,
    ObjectPropertyJSON,
    ObjectPropertyWithLikelihood,
    RelationshipsRequest,
    ScopedRequest,
)
from app.models.common import ErrorResponse
from app.models.job import JobType, JobCreateResponse
from app.core.job_manager import job_manager

router = APIRouter()


@router.post(
    "/concepts",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate ontology concepts (async)",
    description=(
        "Starts a background job to generate ontology concepts for given tables. "
        "Returns immediately with a job ID. Use GET /jobs/{jobId} to check progress."
    ),
)
async def generate_concepts(
    request: ScopedRequest = Body(...),
    samples: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Number of stochastic generations to sample",
    ),
    service: OntologyServiceDep = None,
) -> JobCreateResponse:
    """
    Start a concepts generation job.

    - **databaseId**: Database identifier
    - **tables**: List of tables to analyze
    - **modelingHints**: Optional domain hints, aliases, constraints
    - **samples**: Number of samples (1 = single result, >1 = probabilistic list)
    """
    # Create job
    job = job_manager.create_job(
        job_type=JobType.CONCEPTS,
        database_id=request.databaseId,
        parameters={"samples": samples, "tables": [t.dict() for t in request.tables]}
    )
    
    # Start background task
    async def run_concepts():
        """Background task to generate concepts"""
        try:
            job_manager.update_progress(job.id, 0, 100, "Analyzing table schemas...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 30, 100, "Identifying entities...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 60, 100, "Generating concepts...")
            result = await service.generate_concepts(request=request, samples=samples)
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 90, 100, "Finalizing...")
            await asyncio.sleep(0.3)
            
            return result
        except Exception as e:
            raise e
    
    # Start the job
    job_manager.start_job(job.id, run_concepts)
    
    return JobCreateResponse(jobId=job.id)


@router.post(
    "/attributes",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate/augment attributes (async)",
    description=(
        "Starts a background job to generate attributes for a given concept and tables. "
        "Returns immediately with a job ID. Use GET /jobs/{jobId} to check progress."
    ),
)
async def generate_attributes(
    request: AttributesRequest = Body(...),
    samples: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Number of stochastic generations to sample",
    ),
    service: OntologyServiceDep = None,
) -> JobCreateResponse:
    """
    Start an attributes generation job.

    - **databaseId**: Database identifier
    - **tables**: List of tables to analyze
    - **concept**: Seed concept to be augmented with attributes
    - **modelingHints**: Optional hints
    - **samples**: Number of samples (1 = single concept, >1 = probabilistic list)
    """
    # Create job
    job = job_manager.create_job(
        job_type=JobType.ATTRIBUTES,
        database_id=request.databaseId,
        parameters={"samples": samples}
    )
    
    # Start background task
    async def run_attributes():
        """Background task to generate attributes"""
        try:
            job_manager.update_progress(job.id, 0, 100, "Analyzing concept structure...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 30, 100, "Mapping table columns...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 60, 100, "Generating attributes...")
            result = await service.generate_attributes(request=request, samples=samples)
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 90, 100, "Finalizing...")
            await asyncio.sleep(0.3)
            
            return result
        except Exception as e:
            raise e
    
    # Start the job
    job_manager.start_job(job.id, run_attributes)
    
    return JobCreateResponse(jobId=job.id)


@router.post(
    "/relationships",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate ALL relationships (async)",
    description=(
        "Starts a background job to generate object properties (relationships) for given concepts and attributes. "
        "Returns immediately with a job ID. Use GET /jobs/{jobId} to check progress."
    ),
)
async def generate_relationships(
    request: RelationshipsRequest = Body(...),
    samples: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Number of stochastic generations to sample",
    ),
    service: OntologyServiceDep = None,
) -> JobCreateResponse:
    """
    Start a relationships generation job.

    - **databaseId**: Database identifier
    - **tables**: List of tables to analyze
    - **concepts**: Concepts identified by id_attributes
    - **attributes**: Known attributes for the concepts
    - **modelingHints**: Optional cardinality hints, FK conventions
    - **samples**: Number of samples (1 = single result, >1 = probabilistic list)
    """
    # Create job
    job = job_manager.create_job(
        job_type=JobType.RELATIONSHIPS,
        database_id=request.databaseId,
        parameters={"samples": samples}
    )
    
    # Start background task
    async def run_relationships():
        """Background task to generate relationships"""
        try:
            job_manager.update_progress(job.id, 0, 100, "Analyzing concept relationships...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 30, 100, "Identifying foreign keys...")
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 60, 100, "Generating relationships...")
            result = await service.generate_relationships(request=request, samples=samples)
            await asyncio.sleep(0.5)
            
            job_manager.update_progress(job.id, 90, 100, "Finalizing...")
            await asyncio.sleep(0.3)
            
            return result
        except Exception as e:
            raise e
    
    # Start the job
    job_manager.start_job(job.id, run_relationships)
    
    return JobCreateResponse(jobId=job.id)
