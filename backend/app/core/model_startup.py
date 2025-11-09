"""
Model startup configuration for initializing AI models at application start.

This module should be called during FastAPI startup to begin loading models in the background.
"""

import os
from typing import Optional
from app.services.model_manager import ModelManager, get_model_manager
from app.core.logging import get_logger

logger = get_logger(__name__)


async def initialize_models_on_startup(
    base_model_path: Optional[str] = None,
    concept_adapter_path: Optional[str] = None,
    relationship_adapter_path: Optional[str] = None,
    attribute_adapter_path: Optional[str] = None,
    naming_adapter_path: Optional[str] = None,
    base_adapter_path: Optional[str] = None,
    gpu_memory_utilization: float = 0.85,  # High since base model stays loaded
    tensor_parallel_size: int = 1,
    max_model_len: Optional[int] = None,
    auto_unload: bool = False,  # Base model stays loaded, adapters are swapped
):
    """
    Configure AI models during application startup with a persistent base model.
    
    The base model is loaded once and kept in GPU memory. Different LoRA adapters
    are applied on top of the base model for different tasks (concept, relationship,
    attribute, naming extraction). Adapters are swapped as needed.
    
    This function should be called in your FastAPI startup event handler.
    
    Args:
        base_model_path: Path or HF model ID for the base model (e.g., "Qwen/Qwen3-14B")
        concept_adapter_path: LoRA adapter for concept extraction
        relationship_adapter_path: LoRA adapter for relationship extraction
        attribute_adapter_path: LoRA adapter for attribute extraction
        naming_adapter_path: LoRA adapter for naming
        base_adapter_path: Optional base adapter (if needed)
        gpu_memory_utilization: GPU memory fraction (0.0-1.0), can be high since only base model is loaded
        tensor_parallel_size: Number of GPUs for tensor parallelism
        max_model_len: Maximum sequence length (None = model default)
        auto_unload: If True, adapters are unloaded after use (default False for adapter swapping)
    
    Example:
        # In your main FastAPI app:
        
        @app.on_event("startup")
        async def startup_event():
            await initialize_models_on_startup(
                base_model_path="Qwen/Qwen3-14B",
                concept_adapter_path="/path/to/concept/adapter",
                relationship_adapter_path="/path/to/relationship/adapter",
                attribute_adapter_path="/path/to/attribute/adapter",
                naming_adapter_path="/path/to/naming/adapter",
                gpu_memory_utilization=0.85,
                auto_unload=False,
            )
    """
    logger.info("=" * 80)
    logger.info("Configuring AI Model Manager (Base Model + Adapters)")
    logger.info("=" * 80)
    
    # Get model manager instance
    model_mgr = get_model_manager()
    
    # Import your FastLocalModel class
    try:
        from hamilton.pipeline.models.fast_local import FastLocalModel
    except ImportError:
        logger.error("Could not import FastLocalModel. Check your module path.")
        raise
    
    # Load base model and adapter paths from environment variables if not provided
    base_model_path = base_model_path or os.getenv("BASE_MODEL_PATH")
    base_adapter_path = base_adapter_path or os.getenv("BASE_ADAPTER_PATH")
    concept_adapter_path = concept_adapter_path or os.getenv("CONCEPT_ADAPTER_PATH")
    relationship_adapter_path = relationship_adapter_path or os.getenv("RELATIONSHIP_ADAPTER_PATH")
    attribute_adapter_path = attribute_adapter_path or os.getenv("ATTRIBUTE_ADAPTER_PATH")
    naming_adapter_path = naming_adapter_path or os.getenv("NAMING_ADAPTER_PATH")
    
    # Log configuration
    logger.info("Model Configuration:")
    logger.info(f"  Base Model: {base_model_path or 'Not configured'}")
    logger.info(f"  Base Adapter: {base_adapter_path or 'None'}")
    logger.info(f"  Concept Adapter: {concept_adapter_path or 'None'}")
    logger.info(f"  Relationship Adapter: {relationship_adapter_path or 'None'}")
    logger.info(f"  Attribute Adapter: {attribute_adapter_path or 'None'}")
    logger.info(f"  Naming Adapter: {naming_adapter_path or 'None'}")
    logger.info(f"  GPU Memory Utilization: {gpu_memory_utilization}")
    logger.info(f"  Tensor Parallel Size: {tensor_parallel_size}")
    logger.info(f"  Auto-Unload: {'Enabled' if auto_unload else 'Disabled (base model stays loaded)'}")
    
    # Configure models (base model + adapters)
    await model_mgr.configure_models(
        base_model_path=base_model_path,
        base_adapter_path=base_adapter_path,
        concept_adapter_path=concept_adapter_path,
        relationship_adapter_path=relationship_adapter_path,
        attribute_adapter_path=attribute_adapter_path,
        naming_adapter_path=naming_adapter_path,
        model_class=FastLocalModel,
        gpu_memory_utilization=gpu_memory_utilization,
        tensor_parallel_size=tensor_parallel_size,
        max_model_len=max_model_len,
        auto_unload=auto_unload,
        lazy_load=False,  # Base model loads immediately
    )
    
    logger.info("=" * 80)
    logger.info("Model manager configured successfully")
    logger.info("Base model loaded and will stay in GPU memory")
    logger.info("Adapters will be swapped as needed for different tasks")
    logger.info("=" * 80)


async def shutdown_models():
    """
    Cleanup function to unload all models on application shutdown.
    
    This should be called in your FastAPI shutdown event handler.
    
    Example:
        @app.on_event("shutdown")
        async def shutdown_event():
            await shutdown_models()
    """
    logger.info("Shutting down models...")
    model_mgr = get_model_manager()
    model_mgr.unload_all_models()
    logger.info("All models unloaded")
