"""Service for attribute generation for concepts."""

from app.core.logging import get_logger
from app.models.concept import Concept, ConceptAttribute
from app.services.model_manager import get_model_manager
from app.config import settings
from typing import List, Optional, Dict, Any
import asyncio

logger = get_logger(__name__)


class AttributeService:
    """Service for generating attributes for concepts."""

    def __init__(self):
        """Initialize the attribute service."""
        self.model_manager = get_model_manager()

    async def generate_attributes_for_concept(
        self,
        concept: Concept,
        database_id: str,
        table_names: List[str],
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Generate attributes for a single concept.
        
        Args:
            concept: The concept to generate attributes for
            database_id: Database identifier
            table_names: List of table names in the cluster (for schema context)
            progress_callback: Optional callback(current, total, message)
            
        Returns:
            Dictionary containing the concept and its generated attributes
        """
        logger.info(
            f"Generating attributes for concept '{concept.name or concept.id}' "
            f"in database {database_id}"
        )
        
        # Step 1: Report initial progress
        if progress_callback:
            progress_callback(0, 100, f"Analyzing concept '{concept.name}'...")
        
        # Step 2: Call attribute generation logic
        attributes = await self._generate_attributes(
            concept=concept,
            database_id=database_id,
            table_names=table_names,
            progress_callback=progress_callback
        )
        
        # Step 3: Final progress
        if progress_callback:
            progress_callback(100, 100, f"Generated {len(attributes)} attributes")
        
        logger.info(
            f"Attribute generation complete for concept '{concept.name}': "
            f"{len(attributes)} attributes"
        )
        
        return {
            "concept": concept,
            "attributes": attributes,
            "attributeCount": len(attributes)
        }

    async def _generate_attributes(
        self,
        concept: Concept,
        database_id: str,
        table_names: List[str],
        progress_callback=None
    ) -> List[ConceptAttribute]:
        """
        Generate attributes using the extract_attributes_for_concept function.
        
        This method uses the attribute LoRA adapter to generate attributes
        based on the concept and database schema.
        
        Args:
            concept: The concept to generate attributes for
            database_id: Database identifier to fetch schema
            table_names: List of tables in the cluster (for schema context)
            progress_callback: Function to report progress
        
        Returns:
            List of ConceptAttribute objects
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
            progress_callback(20, 100, "Loading attribute model...")
        
        # Convert concept to dict format for the extraction function
        concept_dict = concept.model_dump(by_alias=True)
        
        # Get adapter paths from settings
        attribute_adapter_path = getattr(settings, 'ATTRIBUTE_ADAPTER_PATH', None)
        naming_adapter_path = getattr(settings, 'NAMING_ADAPTER_PATH', None)
        
        # Use context manager for model with LoRA adapter swapping support
        try:
            with self.model_manager.use_model("attribute") as model:
                if progress_callback:
                    progress_callback(30, 100, "Extracting attributes...")
                
                # Import the attribute extraction function
                from evaluator.experimenter.solutions.hamilton.hamilton.distinct_methods.extract_attributes import (
                    extract_attributes_for_concept
                )
                
                loop = asyncio.get_event_loop()
                
                # Run the extraction in a thread pool executor to avoid blocking
                ai_response = await loop.run_in_executor(
                    None,
                    extract_attributes_for_concept,
                    concept_dict,           # concept
                    table_names,            # table_names
                    database_id,            # database_id
                    database,               # database (PostgresClient)
                    model,                  # model (pre-loaded)
                    None,                   # model_path (not needed)
                    attribute_adapter_path, # adapter_path (attribute LoRA)
                    False,                  # use_fast_inference (model already loaded)
                    None,                   # naming_model (deprecated)
                    None,                   # naming_model_path (deprecated)
                    naming_adapter_path,    # naming_adapter_path (naming LoRA)
                    True,                   # naming_enabled
                    progress_callback,      # progress_callback
                    False,                  # use_table_names_only
                    True,                   # verbose
                )
                
                logger.info(f"Attribute extraction complete for concept '{concept.name}'")
                
        except Exception as e:
            logger.error(f"Error during attribute extraction: {e}")
            raise RuntimeError(f"Failed to extract attributes: {e}")
        
        # Model is automatically unloaded here (context manager exit)
        
        if progress_callback:
            progress_callback(70, 100, "Parsing results...")
        
        # Parse the response into ConceptAttribute objects
        try:
            attributes = self._parse_ai_response(ai_response)
            logger.info(f"Parsed {len(attributes)} attributes from extraction results")
        except Exception as e:
            logger.error(f"Error parsing extraction results: {e}")
            raise RuntimeError(f"Failed to parse attribute results: {e}")
        
        if progress_callback:
            progress_callback(90, 100, f"Validated {len(attributes)} attributes...")
        
        # Small delay to ensure progress callbacks are flushed
        await asyncio.sleep(0.1)
        
        return attributes
    
    def _parse_ai_response(self, ai_response: dict) -> List[ConceptAttribute]:
        """
        Parse the AI model's response into ConceptAttribute objects.
        
        Args:
            ai_response: The extraction function's output
            
        Returns:
            List of ConceptAttribute objects
        """
        attributes = []
        
        # The extract_attributes_for_concept function returns a dict with:
        # {
        #   "concept": {...},
        #   "database_id": "...",
        #   "table_names": [...],
        #   "attributes": [
        #     {
        #       "table": "...",
        #       "column": "...",
        #       "name": "..."  (if naming enabled)
        #     },
        #     ...
        #   ],
        #   "attribute_count": N,
        #   "metadata": {...}
        # }
        
        for attr_data in ai_response.get("attributes", []):
            # Extract table and column
            table = attr_data.get("table")
            column = attr_data.get("column")
            name = attr_data.get("name")
            
            if not table or not column:
                logger.warning(f"Skipping attribute with missing table or column: {attr_data}")
                continue
            
            # Create ConceptAttribute
            attribute = ConceptAttribute(
                table=table,
                column=column,
                name=name
            )
            
            attributes.append(attribute)
        
        return attributes
