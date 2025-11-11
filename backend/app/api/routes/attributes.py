"""
API endpoints for attribute generation.

The attribute generation workflow:
1. Frontend passes the concept object and cluster table names in the request
2. Backend uses AttributeService with the attribute LoRA adapter
3. Attributes are generated based on the concept and database schema
4. Results are returned via job polling
"""

import asyncio
from fastapi import APIRouter, Body, status, HTTPException
from typing import List, Dict, Any

from app.models.concept import Concept, ConceptAttribute
from app.models.common import ErrorResponse
from app.models.job import JobType, JobCreateResponse
from app.core.job_manager import job_manager
from app.core.logging import get_logger
from app.services.attribute_service import AttributeService
from typing import List

logger = get_logger(__name__)
router = APIRouter()


# Dependency injection for service
attribute_service = AttributeService()


@router.post(
    "/databases/{database_id}/concepts/{concept_id}/attributes",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database or concept not found"},
    },
    summary="Generate attributes for a concept (async)",
    description=(
        "Starts a background job to generate attributes for a concept. "
        "Uses the attribute LoRA adapter to analyze the concept and database schema. "
        "Use GET /jobs/{jobId} to check progress and retrieve results."
    ),
)
async def generate_attributes(
    database_id: str,
    concept_id: str,
    request: Dict[str, Any] = Body(default=None, description="Request containing concept and tableNames"),
) -> JobCreateResponse:
    """
    Generate attributes for a concept.
    
    Uses the attribute LoRA adapter to analyze the concept and suggest
    relevant attributes based on the database schema.
    
    - **database_id**: Database identifier
    - **concept_id**: Concept identifier
    - **request**: Dict containing:
        - concept: The Concept object (required)
        - tableNames: List of table names in the cluster (required)
    """
    # Handle case where request body is not provided
    if request is None:
        logger.error("No request body provided - request is None")
        raise HTTPException(
            status_code=400,
            detail=(
                "Request body is required. Please provide: "
                "{ 'concept': <Concept object>, 'tableNames': <list of table names> }. "
                "Make sure the frontend is sending the request body."
            )
        )
    
    # Extract concept and table names from request
    concept_data = request.get("concept")
    table_names = request.get("tableNames", [])
    
    if not concept_data:
        raise HTTPException(
            status_code=400,
            detail="Concept data is required in request body"
        )
    
    # Parse concept from dict
    try:
        concept = Concept(**concept_data)
    except Exception as e:
        logger.error(f"Failed to parse concept: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid concept data: {str(e)}"
        )
    
    logger.info(
        f"Generating attributes for concept '{concept.name}' "
        f"with {len(table_names)} tables in cluster"
    )
    
    # Create job
    job = job_manager.create_job(
        job_type=JobType.ATTRIBUTES,
        database_id=database_id
    )
    
    logger.info(f"Created job {job.id} for concept '{concept.name}'")
    
    # Start background task
    async def run_attribute_generation():
        """Background task to generate attributes"""
        try:
            # Progress callback
            def progress(current: int, total: int, message: str):
                job_manager.update_progress(job.id, current, total, message)
            
            # Update progress
            progress(0, 100, f"Starting attribute generation for '{concept.name}'...")
            
            # Generate attributes
            result = await attribute_service.generate_attributes_for_concept(
                concept=concept,
                database_id=database_id,
                table_names=table_names,
                progress_callback=progress
            )
            
            # Format result for JSON response
            final_result = {
                "databaseId": database_id,
                "conceptId": concept_id,
                "conceptName": concept.name,
                "attributes": [
                    attr.model_dump(by_alias=True)
                    for attr in result["attributes"]
                ],
                "attributeCount": result["attributeCount"]
            }
            
            progress(100, 100, f"Generated {result['attributeCount']} attributes")
            
            logger.info(
                f"Attribute generation complete for concept '{concept.name}': "
                f"{result['attributeCount']} attributes"
            )
            
            return final_result
            
        except Exception as e:
            logger.exception(f"Attribute generation job {job.id} failed: {str(e)}")
            raise
    
    # Start the job
    job_manager.start_job(job.id, run_attribute_generation)
    
    return JobCreateResponse(jobId=job.id)


@router.post(
    "/databases/{database_id}/concepts/{concept_id}/attributes/save",
    response_model=dict,
    responses={
        404: {"model": ErrorResponse, "description": "Database or concept not found"},
    },
    summary="Save confirmed attributes for a concept",
    description="Saves the confirmed/edited attributes for a concept.",
)
async def save_attributes(
    database_id: str,
    concept_id: str,
    attributes: List[ConceptAttribute] = Body(..., description="List of confirmed attributes"),
) -> dict:
    """
    Save confirmed attributes for a concept.
    
    In a real implementation, this would persist the attributes to a database.
    For now, this is a placeholder that acknowledges the save request.
    
    - **database_id**: Database identifier
    - **concept_id**: Concept identifier
    - **attributes**: List of confirmed attributes
    """
    logger.info(
        f"Saving {len(attributes)} attributes for concept {concept_id} "
        f"in database {database_id}"
    )
    
    # TODO: Implement actual persistence logic
    # This would typically:
    # 1. Validate the attributes
    # 2. Store them in a database
    # 3. Update the concept's attribute list
    
    return {
        "success": True,
        "message": f"Saved {len(attributes)} attributes for concept {concept_id}",
        "conceptId": concept_id,
        "attributeCount": len(attributes)
    }
