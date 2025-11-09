"""
Example usage of ModelManager with your FastLocalModel for concept/relationship/attribute extraction.

This file demonstrates:
1. How to initialize models at application startup
2. How to use models in your services
3. How to check model loading status
"""

from fastapi import FastAPI
from app.core.model_startup import initialize_models_on_startup, shutdown_models
from app.services.model_manager import get_model_manager


# ===================================================================
# EXAMPLE 1: FastAPI Application Startup
# ===================================================================

app = FastAPI(title="Hamilton GUI API")


@app.on_event("startup")
async def startup_event():
    """
    Initialize models when the application starts.
    
    Models will load in the background while the API server starts.
    The API will be available immediately, but concept/relationship/attribute
    endpoints will wait for models to load if needed.
    """
    # Option A: Use environment variables
    # Set these in your .env file:
    # CONCEPT_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
    # CONCEPT_ADAPTER_PATH=/path/to/concept/adapter
    # RELATIONSHIP_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
    # RELATIONSHIP_ADAPTER_PATH=/path/to/relationship/adapter
    # ATTRIBUTE_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
    # ATTRIBUTE_ADAPTER_PATH=/path/to/attribute/adapter
    
    await initialize_models_on_startup()
    
    # Option B: Specify paths directly
    # await initialize_models_on_startup(
    #     concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    #     concept_adapter_path="/path/to/concept/adapter",
    #     relationship_model_path="Qwen/Qwen2.5-14B-Instruct",
    #     relationship_adapter_path="/path/to/relationship/adapter",
    #     attribute_model_path="Qwen/Qwen2.5-14B-Instruct",
    #     attribute_adapter_path="/path/to/attribute/adapter",
    #     gpu_memory_utilization=0.3,  # Use 30% per model
    #     tensor_parallel_size=1,
    # )


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup models when application shuts down."""
    await shutdown_models()


# ===================================================================
# EXAMPLE 2: Checking Model Status Endpoint
# ===================================================================

@app.get("/api/models/status")
async def get_model_status():
    """
    Check the loading status of all models.
    
    Returns:
        {
            "concept": "ready" | "loading" | "not_loaded" | "error",
            "relationship": "ready" | "loading" | "not_loaded" | "error",
            "attribute": "ready" | "loading" | "not_loaded" | "error"
        }
    """
    model_mgr = get_model_manager()
    return model_mgr.get_all_statuses()


# ===================================================================
# EXAMPLE 3: Using Models in Your Services
# ===================================================================

class ExampleConceptService:
    """Example showing how to use the concept model in your service."""
    
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_concepts(self, table_names: list[str]) -> dict:
        """
        Extract concepts from table names using the AI model.
        
        The model will be loaded automatically if it's still loading.
        """
        # Option A: Check if ready and get immediately
        if self.model_manager.is_ready("concept"):
            model = self.model_manager.get_model("concept")
        else:
            # Option B: Wait for model to be ready (with timeout)
            model = await self.model_manager.wait_for_model("concept", timeout=300)
        
        # Now use the model
        prompt = [
            {
                "role": "system",
                "content": "Extract concepts from database tables."
            },
            {
                "role": "user",
                "content": f"Tables: {', '.join(table_names)}"
            }
        ]
        
        result = model.generate_modeling(prompt)
        return result


class ExampleRelationshipService:
    """Example showing how to use the relationship model in your service."""
    
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_relationships(self, concepts: list) -> dict:
        """Extract relationships between concepts using the AI model."""
        # Wait for model if not ready yet
        model = await self.model_manager.wait_for_model("relationship", timeout=300)
        
        prompt = [
            {
                "role": "system",
                "content": "Identify relationships between concepts."
            },
            {
                "role": "user",
                "content": f"Find relationships for: {concepts}"
            }
        ]
        
        result = model.generate_modeling(prompt)
        return result


class ExampleAttributeService:
    """Example showing how to use the attribute model in your service."""
    
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_attributes(self, concept: dict) -> dict:
        """Extract attributes for a concept using the AI model."""
        # Wait for model if not ready yet
        model = await self.model_manager.wait_for_model("attribute", timeout=300)
        
        prompt = [
            {
                "role": "system",
                "content": "Extract relevant attributes for a concept."
            },
            {
                "role": "user",
                "content": f"Concept: {concept}"
            }
        ]
        
        result = model.generate_modeling(prompt)
        return result


# ===================================================================
# EXAMPLE 4: Manual Model Loading (if not using startup event)
# ===================================================================

async def manually_load_models():
    """
    If you need to load models manually instead of at startup.
    
    This is useful for testing or if you want to load models on-demand.
    """
    from hamilton.pipeline.models.fast_local_model import FastLocalModel
    from app.services.model_manager import ModelManager
    
    model_mgr = ModelManager.get_instance()
    
    await model_mgr.initialize_models(
        concept_model_path="Qwen/Qwen2.5-14B-Instruct",
        concept_adapter_path="/path/to/adapter",
        model_class=FastLocalModel,
        gpu_memory_utilization=0.3,
    )
    
    # Wait for all models to finish loading
    await model_mgr.wait_for_all_models(timeout=600)
    
    print("All models ready!")


# ===================================================================
# EXAMPLE 5: Using Models with Context Manager
# ===================================================================

async def example_with_context_manager():
    """
    Example showing model usage with context manager.
    
    Note: The model is already loaded by ModelManager, so you don't need
    the context manager for FastLocalModel. This is just for reference.
    """
    model_mgr = get_model_manager()
    
    # Get the model (already loaded by manager)
    concept_model = await model_mgr.wait_for_model("concept")
    
    # Use it directly (no need for context manager)
    prompt = [{"role": "user", "content": "Extract concepts from: Person, Address"}]
    result = concept_model.generate_modeling(prompt)
    
    return result


# ===================================================================
# EXAMPLE 6: Batch Processing with Multiple Models
# ===================================================================

async def batch_process_database():
    """
    Example of processing a database with all three models.
    
    Shows how to use concept → relationship → attribute extraction pipeline.
    """
    model_mgr = get_model_manager()
    
    # Wait for all models to be ready
    print("Waiting for models to load...")
    await model_mgr.wait_for_all_models(timeout=600)
    
    # Get all models
    concept_model = model_mgr.get_model("concept")
    relationship_model = model_mgr.get_model("relationship")
    attribute_model = model_mgr.get_model("attribute")
    
    # Step 1: Extract concepts
    print("Extracting concepts...")
    concept_prompt = [
        {"role": "system", "content": "Extract concepts from database tables."},
        {"role": "user", "content": "Tables: Person, Address, Order"}
    ]
    concepts = concept_model.generate_modeling(concept_prompt)
    
    # Step 2: Extract relationships
    print("Extracting relationships...")
    relationship_prompt = [
        {"role": "system", "content": "Identify relationships between concepts."},
        {"role": "user", "content": f"Concepts: {concepts}"}
    ]
    relationships = relationship_model.generate_modeling(relationship_prompt)
    
    # Step 3: Extract attributes
    print("Extracting attributes...")
    attribute_prompt = [
        {"role": "system", "content": "Extract attributes for concepts."},
        {"role": "user", "content": f"Concepts: {concepts}"}
    ]
    attributes = attribute_model.generate_modeling(attribute_prompt)
    
    return {
        "concepts": concepts,
        "relationships": relationships,
        "attributes": attributes
    }


# ===================================================================
# EXAMPLE 7: Error Handling
# ===================================================================

async def example_with_error_handling():
    """Example showing proper error handling when using models."""
    from app.services.model_manager import ModelStatus
    
    model_mgr = get_model_manager()
    
    try:
        # Check status first
        status = model_mgr.get_status("concept")
        
        if status == ModelStatus.ERROR:
            print("Model failed to load!")
            return {"error": "Model not available"}
        
        if status == ModelStatus.NOT_LOADED:
            print("Model not initialized!")
            return {"error": "Model not configured"}
        
        # Wait for model with timeout
        try:
            model = await model_mgr.wait_for_model("concept", timeout=300)
        except TimeoutError:
            print("Model took too long to load!")
            return {"error": "Model loading timeout"}
        
        # Use the model
        result = model.generate_modeling([
            {"role": "user", "content": "Test prompt"}
        ])
        
        return result
        
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}
