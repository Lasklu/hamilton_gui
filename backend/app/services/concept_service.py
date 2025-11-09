"""Service for concept generation from database clusters."""

from app.core.logging import get_logger
from app.models.concept import (
    Concept, 
    ConceptSuggestion, 
    ConceptAttribute, 
    ConceptIDAttribute,
    ConceptCondition
)
from app.services.model_manager import get_model_manager, ModelStatus
from app.config import settings
from typing import List, Optional
import asyncio

logger = get_logger(__name__)


class ConceptService:
    """Service for generating and managing concepts from database clusters."""

    def __init__(self):
        """Initialize the concept service."""
        self.model_manager = get_model_manager()

    async def process_cluster(
        self,
        cluster_id: int,
        table_names: List[str],
        database_id: str,
        existing_concepts: Optional[List[Concept]] = None,
        progress_callback=None
    ) -> ConceptSuggestion:
        """
        Process a single cluster to generate concepts.
        
        This is your main implementation point. Replace the logic below with
        your AI model call.
        
        Args:
            cluster_id: ID of the cluster being processed
            table_names: List of table names in this cluster
            database_id: Database identifier
            existing_concepts: Previously generated concepts (for context)
            progress_callback: Optional callback(current, total, message)
            
        Returns:
            ConceptSuggestion containing generated concepts
            
        Example:
            concepts = await self.your_ai_model.generate(
                tables=table_names,
                database_id=database_id,
                context=existing_concepts
            )
            
            return ConceptSuggestion(concepts=concepts)
        """
        logger.info(
            f"Processing cluster {cluster_id} with {len(table_names)} tables "
            f"(existing concepts: {len(existing_concepts) if existing_concepts else 0})"
        )
        
        # Step 1: Report initial progress
        if progress_callback:
            progress_callback(0, 100, f"Analyzing {len(table_names)} tables...")
        
        # Step 2: Call your concept generation logic
        concepts = await self._generate_concepts(
            cluster_id=cluster_id,
            table_names=table_names,
            database_id=database_id,
            existing_concepts=existing_concepts,
            progress_callback=progress_callback
        )
        
        # Step 3: Final progress
        if progress_callback:
            progress_callback(100, 100, f"Generated {len(concepts)} concepts")
        
        logger.info(f"Cluster {cluster_id} processing complete: {len(concepts)} concepts")
        
        return ConceptSuggestion(concepts=concepts)

    async def _generate_concepts(
        self,
        cluster_id: int,
        table_names: List[str],
        database_id: str,
        existing_concepts: Optional[List[Concept]],
        progress_callback=None
    ) -> List[Concept]:
        """
        Generate concepts using the concept extraction function.
        
        This method receives:
        - cluster_id: The cluster being processed
        - table_names: List of tables in this cluster (e.g., ["Person", "Address"])
        - database_id: Database identifier to fetch schema if needed
        - existing_concepts: Concepts from previous clusters (for context)
        - progress_callback: Function to report progress
        
        Returns list of Concept objects.
        """
        
        if progress_callback:
            progress_callback(10, 100, "Preparing database connection...")
        
        # Create PostgresClient for database connection
        from evaluator.experimenter.database_client.postgresclient import PostgresClient
        
        try:
            database = PostgresClient(
                database_id,
                user=settings.POSTGRES_ADMIN_USER,
                password=settings.POSTGRES_ADMIN_PASSWORD,
                host=settings.POSTGRES_ADMIN_HOST,
                port=int(settings.POSTGRES_ADMIN_PORT),
            )
            logger.debug(f"Created database connection for {database_id}")
        except Exception as e:
            logger.error(f"Failed to create database connection: {e}")
            raise RuntimeError(f"Failed to connect to database: {e}")
        
        if progress_callback:
            progress_callback(20, 100, "Preparing model...")
        
        # Convert existing concepts to dict format for your function
        existing_concepts_dict = None
        if existing_concepts:
            existing_concepts_dict = [
                concept.model_dump(by_alias=True) 
                for concept in existing_concepts
            ]
        
        # Get adapter paths from settings (already imported at top)
        concept_adapter_path = getattr(settings, 'CONCEPT_ADAPTER_PATH', None)
        naming_adapter_path = getattr(settings, 'NAMING_ADAPTER_PATH', None)
        
        # Use context manager for ONE model (with LoRA adapter swapping support)
        # The extract_concepts function will handle adapter swapping internally
        try:
            with self.model_manager.use_model("concept") as model:
                if progress_callback:
                    progress_callback(30, 100, "Extracting concepts...")
                
                # Import your concept extraction function
                from evaluator.experimenter.solutions.hamilton.hamilton.distinct_methods.extract_concepts import extract_concepts_from_cluster
                
                loop = asyncio.get_event_loop()
                
                ai_response = await loop.run_in_executor(
                    None,
                    extract_concepts_from_cluster,
                    cluster_id,
                    table_names,
                    database_id,
                    database,
                    model,  # Single model instance
                    None,   # model_path (not needed, model already loaded)
                    concept_adapter_path,  # concept LoRA adapter
                    False,  # use_fast_inference (model already loaded)
                    existing_concepts_dict,
                    None,   # naming_model (deprecated, use naming_adapter_path instead)
                    None,   # naming_model_path (deprecated)
                    naming_adapter_path,  # naming LoRA adapter
                    True,   # naming_enabled
                    progress_callback,
                    False,  # use_table_names_only
                    True,   # verbose
                )
                
                logger.info(f"Concept extraction complete for cluster {cluster_id}")
                
        except Exception as e:
            logger.error(f"Error during concept extraction: {e}")
            raise RuntimeError(f"Failed to extract concepts: {e}")
        
        # Models are automatically unloaded here (context manager exit)
        
        if progress_callback:
            progress_callback(70, 100, "Parsing results...")
        
        # Parse the response into Concept objects
        try:
            concepts = self._parse_ai_response(ai_response, cluster_id)
            logger.info(f"Parsed {len(concepts)} concepts from extraction results")
        except Exception as e:
            logger.error(f"Error parsing extraction results: {e}")
            raise RuntimeError(f"Failed to parse concept results: {e}")
        
        if progress_callback:
            progress_callback(90, 100, f"Validated {len(concepts)} concepts...")
        
        # Small delay to ensure progress callbacks are flushed
        await asyncio.sleep(0.1)
        
        return concepts
    
    def _parse_ai_response(self, ai_response: dict, cluster_id: int) -> List[Concept]:
        """
        Helper method to parse your AI model's response.
        
        Args:
            ai_response: Your AI model's output (dict/json)
            cluster_id: Current cluster ID
            
        Returns:
            List of Concept objects
            
        Example implementation for your JSON structure:
        """
        concepts = []
        
        for concept_data in ai_response.get("concepts", []):
            # Parse ID attributes
            id_attributes = [
                ConceptIDAttribute(
                    attributes=[
                        ConceptAttribute(**attr)
                        for attr in id_attr["attributes"]
                    ]
                )
                for id_attr in concept_data.get("idAttributes", concept_data.get("id_attributes", []))
            ]
            
            # Parse conditions (if any)
            conditions = None
            if "conditions" in concept_data:
                conditions = [
                    ConceptCondition(**cond)
                    for cond in concept_data["conditions"]
                ]
            
            # Parse sub-concepts recursively (if any)
            sub_concepts = None
            if "subConcepts" in concept_data or "sub_concepts" in concept_data:
                sub_data = concept_data.get("subConcepts", concept_data.get("sub_concepts", []))
                sub_concepts = self._parse_ai_response(
                    {"concepts": sub_data},
                    cluster_id
                )
            
            # Create concept
            concept = Concept(
                id=concept_data.get("id") or f"concept_{cluster_id}_{len(concepts) + 1}",
                name=concept_data.get("name"),
                cluster_id=cluster_id,
                id_attributes=id_attributes,
                attributes=[
                    ConceptAttribute(**attr)
                    for attr in concept_data.get("attributes", [])
                ] if "attributes" in concept_data else None,
                confidence=concept_data.get("confidence"),
                conditions=conditions,
                sub_concepts=sub_concepts
            )
            
            concepts.append(concept)
        
        return concepts
