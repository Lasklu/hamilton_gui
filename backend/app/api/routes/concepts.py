"""API endpoints for concept generation."""

import asyncio
from fastapi import APIRouter, Body, status, HTTPException
from typing import List, Optional

from app.models.concept import Concept, ConceptSuggestion, ClusterConceptsRequest
from app.models.common import ErrorResponse
from app.models.job import JobType, JobCreateResponse
from app.models.clustering import ClusterInfo
from app.core.job_manager import job_manager
from app.core.logging import get_logger
from app.services.concept_service import ConceptService

logger = get_logger(__name__)
router = APIRouter()


# Dependency injection for service
concept_service = ConceptService()


@router.post(
    "/databases/{database_id}/concepts/generate",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate concepts for all clusters (async)",
    description=(
        "Starts a background job to generate concepts for all clusters. "
        "Processes clusters sequentially, updating results incrementally. "
        "Use GET /jobs/{jobId} to check progress and retrieve partial/final results."
    ),
)
async def generate_concepts(
    database_id: str,
    clusters: List[ClusterInfo] = Body(..., description="List of clusters to process"),
) -> JobCreateResponse:
    """
    Generate concepts for all clusters in a database.
    
    Processes clusters one by one, each cluster builds on concepts from previous clusters.
    Results are available incrementally as each cluster completes.
    
    - **database_id**: Database identifier
    - **clusters**: List of cluster information (from clustering step)
    """
    # Create job
    job = job_manager.create_job(
        job_type=JobType.CONCEPTS,
        database_id=database_id,
        parameters={"cluster_count": len(clusters)}
    )
    
    # Start background task
    async def run_concept_generation():
        """Background task to generate concepts cluster by cluster"""
        try:
            all_concepts: List[Concept] = []
            total_clusters = len(clusters)
            
            for cluster_index, cluster in enumerate(clusters):
                cluster_num = cluster_index + 1
                
                # Progress callback for this cluster
                def cluster_progress(current: int, total: int, message: str):
                    # Calculate overall progress: each cluster is a portion of the total
                    cluster_weight = 100 / total_clusters
                    cluster_start = cluster_index * cluster_weight
                    cluster_progress_pct = (current / total) * cluster_weight
                    overall_progress = int(cluster_start + cluster_progress_pct)
                    
                    job_manager.update_progress(
                        job.id,
                        overall_progress,
                        100,
                        f"[Cluster {cluster_num}/{total_clusters}] {message}"
                    )
                
                # Update progress
                cluster_progress(0, 100, f"Starting cluster '{cluster.name}'...")
                
                # Process this cluster with context from previous clusters
                cluster_concepts = await concept_service.process_cluster(
                    cluster_id=cluster.cluster_id,
                    table_names=cluster.tables,
                    database_id=database_id,
                    existing_concepts=all_concepts.copy() if all_concepts else None,
                    progress_callback=cluster_progress
                )
                
                # Add new concepts to the collection
                all_concepts.extend(cluster_concepts.concepts)
                
                # Update job with partial results immediately
                # This allows the frontend to display concepts as they're generated
                partial_result = {
                    "databaseId": database_id,
                    "concepts": [concept.model_dump(by_alias=True) for concept in all_concepts],
                    "processedClusters": cluster_num,
                    "totalClusters": total_clusters,
                    "isComplete": cluster_num == total_clusters
                }
                
                # Store partial result in job
                job.result = partial_result
                
                cluster_progress(
                    100,
                    100,
                    f"Completed cluster '{cluster.name}' ({len(cluster_concepts.concepts)} concepts)"
                )
                
                logger.info(
                    f"Cluster {cluster_num}/{total_clusters} complete: "
                    f"{len(cluster_concepts.concepts)} concepts generated, "
                    f"total concepts: {len(all_concepts)}"
                )
            
            # Final result
            final_result = {
                "databaseId": database_id,
                "concepts": [concept.model_dump(by_alias=True) for concept in all_concepts],
                "processedClusters": total_clusters,
                "totalClusters": total_clusters,
                "isComplete": True
            }
            
            return final_result
            
        except Exception as e:
            logger.exception(f"Concept generation job {job.id} failed: {str(e)}")
            raise
    
    # Start the job
    job_manager.start_job(job.id, run_concept_generation)
    
    return JobCreateResponse(jobId=job.id)


@router.post(
    "/databases/{database_id}/concepts/cluster/{cluster_id}",
    response_model=ConceptSuggestion,
    responses={
        404: {"model": ErrorResponse, "description": "Database or cluster not found"},
    },
    summary="Generate concepts for a single cluster (synchronous)",
    description=(
        "Generate concepts for a single cluster. This is a synchronous operation. "
        "Use this for manual/individual cluster processing."
    ),
)
async def generate_concepts_for_cluster(
    database_id: str,
    cluster_id: int,
    table_names: List[str] = Body(..., description="Tables in this cluster"),
    existing_concepts: Optional[List[Concept]] = Body(
        None,
        description="Previously generated concepts (for context)"
    ),
) -> ConceptSuggestion:
    """
    Generate concepts for a single cluster.
    
    - **database_id**: Database identifier
    - **cluster_id**: Cluster identifier
    - **table_names**: List of table names in the cluster
    - **existing_concepts**: Optional list of already generated concepts (provides context)
    """
    try:
        result = await concept_service.process_cluster(
            cluster_id=cluster_id,
            table_names=table_names,
            database_id=database_id,
            existing_concepts=existing_concepts,
            progress_callback=None
        )
        return result
    except NotImplementedError as e:
        raise HTTPException(
            status_code=501,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Failed to generate concepts for cluster {cluster_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate concepts: {str(e)}"
        )
