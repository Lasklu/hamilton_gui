"""
Model Manager for loading and managing multiple AI models.

This manager handles:
- Lazy loading of models (load on first use)
- Automatic unloading of inactive models to save GPU memory
- Thread-safe singleton pattern
- Context manager support for model usage
- Memory management and cleanup
"""

import threading
import asyncio
from typing import Optional, Dict, Any
from enum import Enum
from dataclasses import dataclass, field
from contextlib import contextmanager
import time
from app.core.logging import get_logger

logger = get_logger(__name__)


class ModelStatus(Enum):
    """Status of a model's loading state."""
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    READY = "ready"
    ERROR = "error"
    UNLOADED = "unloaded"  # Was loaded but has been unloaded to save memory


@dataclass
class ModelInfo:
    """Information about a loaded model."""
    status: ModelStatus
    model: Optional[Any] = None
    error: Optional[str] = None
    loading_thread: Optional[threading.Thread] = None
    config: Dict[str, Any] = field(default_factory=dict)  # Store config for reloading
    last_used: float = 0.0  # Timestamp of last use
    use_count: int = 0  # Number of times used


class ModelManager:
    """
    Singleton manager for AI models used in concept/relationship/attribute extraction.
    
    This manager supports two modes:
    1. **Keep-Alive Mode** (default): Models stay loaded after first use
    2. **Auto-Unload Mode**: Automatically unload inactive models to save GPU memory
    
    Usage with context manager (recommended for memory efficiency):
        model_mgr = ModelManager.get_instance()
        
        with model_mgr.use_model("concept") as model:
            result = model.generate_modeling(prompt)
        # Model is automatically unloaded after use
    
    Usage with manual control (keep models loaded):
        model_mgr = ModelManager.get_instance()
        model = await model_mgr.get_or_load_model("concept")
        result = model.generate_modeling(prompt)
        # Model stays loaded for subsequent requests
    """
    
    _instance: Optional['ModelManager'] = None
    _lock = threading.Lock()
    
    def __init__(self):
        """Initialize the model manager (use get_instance() instead)."""
        if ModelManager._instance is not None:
            raise RuntimeError("Use ModelManager.get_instance() instead")
        
        self._models: Dict[str, ModelInfo] = {
            # 'base' holds the underlying base model (kept in GPU memory)
            "base": ModelInfo(status=ModelStatus.NOT_LOADED),
            "concept": ModelInfo(status=ModelStatus.NOT_LOADED),
            "relationship": ModelInfo(status=ModelStatus.NOT_LOADED),
            "attribute": ModelInfo(status=ModelStatus.NOT_LOADED),
            "naming": ModelInfo(status=ModelStatus.NOT_LOADED),
        }
        
        self._config: Dict[str, Dict[str, Any]] = {}
        self._initialized = False
        self._auto_unload = True  # Enable auto-unloading by default
        self._model_locks: Dict[str, threading.Lock] = {
            "base": threading.Lock(),
            "concept": threading.Lock(),
            "relationship": threading.Lock(),
            "attribute": threading.Lock(),
            "naming": threading.Lock(),
        }
        
        logger.info("ModelManager initialized with auto-unload enabled")
    
    @classmethod
    def get_instance(cls) -> 'ModelManager':
        """Get the singleton instance of ModelManager."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def set_auto_unload(self, enabled: bool):
        """
        Enable or disable automatic model unloading.
        
        Args:
            enabled: If True, models are unloaded after each use.
                    If False, models stay loaded in memory.
        """
        self._auto_unload = enabled
        logger.info(f"Auto-unload {'enabled' if enabled else 'disabled'}")
    
    async def configure_models(
        self,
        base_model_path: Optional[str] = None,
        base_adapter_path: Optional[str] = None,
        concept_model_path: Optional[str] = None,
        concept_adapter_path: Optional[str] = None,
        relationship_model_path: Optional[str] = None,
        relationship_adapter_path: Optional[str] = None,
        attribute_model_path: Optional[str] = None,
        attribute_adapter_path: Optional[str] = None,
        naming_model_path: Optional[str] = None,
        naming_adapter_path: Optional[str] = None,
        model_class = None,  # Your FastLocalModel class
        auto_unload: bool = False,  # Keep base model loaded
        **model_kwargs  # Additional kwargs for model initialization
    ):
        """
        Configure models with a persistent base model and task-specific adapters.
        
        The base model is loaded once and kept in GPU memory. Task-specific LoRA
        adapters are applied/swapped on top of the base model as needed.
        
        Args:
            base_model_path: Path to base model (kept in GPU memory)
            base_adapter_path: Optional base adapter
            concept_model_path: Optional separate model for concepts (if not using base + adapter)
            concept_adapter_path: LoRA adapter for concept extraction
            relationship_model_path: Optional separate model for relationships
            relationship_adapter_path: LoRA adapter for relationship extraction
            attribute_model_path: Optional separate model for attributes
            attribute_adapter_path: LoRA adapter for attribute extraction
            naming_model_path: Optional separate model for naming
            naming_adapter_path: LoRA adapter for naming
            model_class: The FastLocalModel class (or your model class)
            auto_unload: If True, unload models after use (False = keep base loaded)
            **model_kwargs: Additional arguments passed to model constructor
        """
        if self._initialized:
            logger.warning("ModelManager already configured, skipping")
            return
        
        # Import FastLocalModel here to avoid circular imports
        if model_class is None:
            try:
                from hamilton.pipeline.models.fast_local import FastLocalModel
                model_class = FastLocalModel
            except ImportError:
                logger.error("Could not import FastLocalModel. Pass model_class parameter.")
                raise
        
        # Store configuration for lazy loading
        # Store configuration - include a base model slot which will be kept loaded
        self._config = {
            "base": {
                "model_path": base_model_path,
                "adapter_path": base_adapter_path,
                "model_class": model_class,
                **model_kwargs
            },
            "concept": {
                "model_path": base_model_path,
                "adapter_path": concept_adapter_path,
                "model_class": model_class,
                **model_kwargs
            },
            "relationship": {
                "model_path": base_model_path,
                "adapter_path": relationship_adapter_path,
                "model_class": model_class,
                **model_kwargs
            },
            "attribute": {
                "model_path": base_model_path,
                "adapter_path": attribute_adapter_path,
                "model_class": model_class,
                **model_kwargs
            },
            "naming": {
                "model_path": base_model_path,
                "adapter_path": naming_adapter_path,
                "model_class": model_class,
                **model_kwargs
            }
        }
        
        # Store config in ModelInfo for later use
        for model_name, config in self._config.items():
            self._models[model_name].config = config
        
        self._auto_unload = auto_unload
        self._initialized = True
        
        logger.info("ModelManager configured")
        logger.info(f"Auto-unload: {'enabled' if auto_unload else 'disabled (base model persistent)'}")
        
        # Don't load base model immediately - it will be loaded on first use
        # This prevents blocking the API startup
        base_cfg = self._config.get('base')
        if base_cfg and base_cfg.get('model_path'):
            logger.info("Base model will be loaded on first use (lazy loading)")
            logger.info("This prevents blocking API startup")
        """
        Initialize models with background loading.
        
        Args:
            concept_model_path: Path to concept extraction model
            concept_adapter_path: Optional LoRA adapter for concept model
            relationship_model_path: Path to relationship extraction model
            relationship_adapter_path: Optional LoRA adapter for relationship model
            attribute_model_path: Path to attribute extraction model
            attribute_adapter_path: Optional LoRA adapter for attribute model
            model_class: The FastLocalModel class (or your model class)
            **model_kwargs: Additional arguments passed to model constructor
        """
        if self._initialized:
            logger.warning("ModelManager already initialized, skipping")
            return
        
        # Import FastLocalModel here to avoid circular imports
        if model_class is None:
            try:
                # Try to import your FastLocalModel
                # Adjust the import path based on where you place this class
                from hamilton.pipeline.models.fast_local import FastLocalModel
                model_class = FastLocalModel
            except ImportError:
                logger.error("Could not import FastLocalModel. Pass model_class parameter.")
                raise
        
        # Store configuration
        self._config = {
            "concept": {
                "model_path": concept_model_path,
                "adapter_path": concept_adapter_path,
                "model_class": model_class,
                **model_kwargs
            },
            "relationship": {
                "model_path": relationship_model_path,
                "adapter_path": relationship_adapter_path,
                "model_class": model_class,
                **model_kwargs
            },
            "attribute": {
                "model_path": attribute_model_path,
                "adapter_path": attribute_adapter_path,
                "model_class": model_class,
                **model_kwargs
            }
        }
        
        # Start background loading for each model
        logger.info("Starting background model loading...")
        
        if concept_model_path:
            self._start_background_loading("concept")
        
        if relationship_model_path:
            self._start_background_loading("relationship")
        
        if attribute_model_path:
            self._start_background_loading("attribute")
        
        self._initialized = True
        logger.info("ModelManager initialization started (models loading in background)")
    
    def _load_model_sync(self, model_name: str):
        """
        Load a model synchronously (used by context manager and lazy loading).
        
        Args:
            model_name: Name of the model to load ("concept", "relationship", "attribute")
        """
        with self._model_locks[model_name]:
            model_info = self._models[model_name]
            print(model_info)
            
            # If already loaded and ready, just return
            if model_info.status == ModelStatus.READY and model_info.model is not None:
                logger.debug(f"[{model_name}] Model already loaded")
                return
            
            # If currently loading, wait for it
            if model_info.status == ModelStatus.LOADING:
                logger.info(f"[{model_name}] Model is loading, waiting...")
                # Wait for loading to complete (check every 0.5s)
                while model_info.status == ModelStatus.LOADING:
                    time.sleep(0.5)
                if model_info.status == ModelStatus.READY:
                    return
                # If error occurred, fall through to reload
            
            try:
                logger.info(f"[{model_name}] Loading model...")
                model_info.status = ModelStatus.LOADING
                
                config = model_info.config.copy()
                model_class = config.pop("model_class")
                config.pop("lazy_load", None)  # Remove if present
                print(config)
                # Create model instance with lazy_load=False to load immediately
                model = model_class(
                    lazy_load=False,
                    **config
                )
                
                # Store the loaded model
                model_info.model = model
                model_info.status = ModelStatus.READY
                model_info.last_used = time.time()
                model_info.use_count += 1
                
                logger.info(f"[{model_name}] Model loaded successfully!")
                
            except Exception as e:
                logger.error(f"[{model_name}] Failed to load model: {e}")
                model_info.status = ModelStatus.ERROR
                model_info.error = str(e)
                raise
    
    def _unload_model_sync(self, model_name: str):
        """
        Unload a model synchronously to free GPU memory.
        
        Args:
            model_name: Name of the model to unload
        """
        with self._model_locks[model_name]:
            model_info = self._models[model_name]
            
            if model_info.model is None:
                logger.debug(f"[{model_name}] Model not loaded, nothing to unload")
                return
            
            try:
                logger.info(f"[{model_name}] Unloading model to free GPU memory...")
                
                # Call model's unload method if available
                if hasattr(model_info.model, 'unload_model'):
                    model_info.model.unload_model()
                elif hasattr(model_info.model, '__exit__'):
                    # Use context manager exit if available
                    model_info.model.__exit__(None, None, None)
                
                # Clear reference
                del model_info.model
                model_info.model = None
                model_info.status = ModelStatus.UNLOADED
                
                logger.info(f"[{model_name}] Model unloaded successfully")
                
            except Exception as e:
                logger.error(f"[{model_name}] Error unloading model: {e}")
    
    @contextmanager
    def use_model(self, model_name: str):
        """
        Context manager for using a model with automatic loading/unloading.
        
        This is the RECOMMENDED way to use models when you have limited GPU memory.
        The model is loaded when entering the context and unloaded when exiting.
        
        Args:
            model_name: "concept", "relationship", "attribute", or "naming"
            
        Yields:
            The loaded model instance
            
        Example:
            model_mgr = get_model_manager()
            
            with model_mgr.use_model("concept") as model:
                result = model.generate_modeling(prompt)
            # Model is automatically unloaded here
        """
        if model_name not in self._models:
            raise ValueError(f"Unknown model: {model_name}")
        
        if not self._initialized:
            raise RuntimeError(
                "ModelManager not configured. "
                "Call configure_models() during app startup."
            )
        
        model_info = self._models[model_name]
        
        # For non-base models we may only have an adapter; allow adapter-only configs
        adapter_path = model_info.config.get("adapter_path")

        # If a base model is configured we can try to apply adapter on top
        base_info = self._models.get('base')

        try:
            # If requesting the base model, just load it
            if model_name == 'base':
                self._load_model_sync('base')
                model_info = self._models['base']
                model_info.last_used = time.time()
                model_info.use_count += 1
                yield model_info.model
                return

            # Load base model if needed (first time use) - this is where the loading happens
            if base_info and base_info.config.get('model_path') and base_info.status == ModelStatus.NOT_LOADED:
                logger.info("=" * 80)
                logger.info("First model inference - loading base model into GPU memory...")
                logger.info("This may take 10-30 seconds...")
                logger.info("=" * 80)
                self._load_model_sync('base')
                logger.info("Base model loaded successfully and ready for adapter switching")

            # If base model exists and is ready and there is an adapter, try to apply adapter
            if base_info and base_info.status == ModelStatus.READY and adapter_path:
                base_model = base_info.model

                # Try common adapter-apply method names on the base model
                apply_candidates = [
                    'apply_adapter', 'load_adapter', 'add_adapter', 'merge_adapter',
                    'load_lora', 'apply_lora'
                ]
                remove_candidates = [
                    'remove_adapter', 'unload_adapter', 'detach_adapter', 'reset_adapter', 'clear_adapters'
                ]

                apply_fn = None
                for name in apply_candidates:
                    if hasattr(base_model, name):
                        apply_fn = getattr(base_model, name)
                        break

                if apply_fn:
                    logger.info(f"Applying adapter {adapter_path} to base model for '{model_name}'")
                    # Call apply function and yield the base model
                    try:
                        apply_fn(adapter_path)
                    except Exception as e:
                        logger.error(f"Applying adapter failed: {e}")
                        # Fall back to per-model load below
                    else:
                        # Use the base model as the model for this logical model
                        model_info.model = base_model
                        model_info.status = ModelStatus.READY
                        model_info.last_used = time.time()
                        model_info.use_count += 1
                        try:
                            yield base_model
                        finally:
                            # Try to remove adapter if possible but keep base loaded
                            for rn in remove_candidates:
                                if hasattr(base_model, rn):
                                    try:
                                        getattr(base_model, rn)()
                                    except Exception:
                                        logger.debug(f"Failed to remove adapter using {rn}")
                            return

            # Otherwise, load a separate model instance (adapter applied during instantiation)
            # Ensure at least model_path or adapter_path exists
            if not model_info.config.get("model_path") and not adapter_path:
                raise RuntimeError(
                    f"Model {model_name} not configured. Provide {model_name}_model_path or {model_name}_adapter_path in configure_models()."
                )

            # Load the model (this will create a separate instance if base can't be used)
            self._load_model_sync(model_name)

            # Update usage stats
            model_info.last_used = time.time()
            model_info.use_count += 1

            # Yield the model for use
            yield model_info.model

        finally:
            # Unload the model if auto_unload is enabled and it's not the persistent base
            if self._auto_unload and model_name != 'base':
                self._unload_model_sync(model_name)
    
    async def get_or_load_model(self, model_name: str) -> Any:
        """
        Get a model, loading it if necessary (keeps it loaded).
        
        Use this if you want the model to stay loaded after use.
        Use use_model() context manager if you want automatic unloading.
        
        Args:
            model_name: "concept", "relationship", "attribute", or "naming"
            
        Returns:
            The loaded model instance
        """
        if model_name not in self._models:
            raise ValueError(f"Unknown model: {model_name}")
        
        if not self._initialized:
            raise RuntimeError(
                "ModelManager not configured. "
                "Call configure_models() during app startup."
            )
        
        model_info = self._models[model_name]
        
        if not model_info.config.get("model_path"):
            raise RuntimeError(
                f"Model {model_name} not configured. "
                f"Provide {model_name}_model_path in configure_models()."
            )
        
        # Load if not already loaded
        if model_info.status not in [ModelStatus.READY, ModelStatus.LOADING]:
            self._load_model_sync(model_name)
        elif model_info.status == ModelStatus.LOADING:
            # Wait for loading to complete
            while model_info.status == ModelStatus.LOADING:
                await asyncio.sleep(0.5)
        
        if model_info.status != ModelStatus.READY:
            raise RuntimeError(f"Model {model_name} failed to load: {model_info.error}")
        
        # Update usage stats
        model_info.last_used = time.time()
        model_info.use_count += 1
        
        return model_info.model
    
    def _start_background_loading(self, model_name: str):
        """
        Start loading a model in a background thread (DEPRECATED - use lazy loading instead).
        
        Args:
            model_name: Name of the model to load ("concept", "relationship", "attribute", "naming")
        """
        logger.warning(f"Background loading is deprecated. Models now use lazy loading.")
        # Just load synchronously for now
        self._load_model_sync(model_name)
    
    def get_status(self, model_name: str) -> ModelStatus:
        """
        Get the loading status of a model.
        
        Args:
            model_name: "concept", "relationship", "attribute", or "naming"
            
        Returns:
            ModelStatus enum value
        """
        if model_name not in self._models:
            raise ValueError(f"Unknown model: {model_name}")
        return self._models[model_name].status
    
    def is_ready(self, model_name: str) -> bool:
        """
        Check if a model is ready for use.
        
        Args:
            model_name: "concept", "relationship", "attribute", or "naming"
            
        Returns:
            True if model is loaded and ready
        """
        return self.get_status(model_name) == ModelStatus.READY
    
    def get_model(self, model_name: str) -> Any:
        """
        Get a loaded model (DEPRECATED - use use_model() or get_or_load_model()).
        
        This method is kept for backward compatibility but doesn't auto-load.
        Use use_model() context manager or get_or_load_model() instead.
        
        Args:
            model_name: "concept", "relationship", "attribute", or "naming"
            
        Returns:
            The loaded model instance
            
        Raises:
            RuntimeError: If model is not ready
        """
        logger.warning(
            f"get_model() is deprecated. Use 'with model_mgr.use_model(\"{model_name}\")' "
            f"or 'await model_mgr.get_or_load_model(\"{model_name}\")' instead."
        )
        
        if model_name not in self._models:
            raise ValueError(f"Unknown model: {model_name}")
        
        model_info = self._models[model_name]
        
        if model_info.status != ModelStatus.READY:
            if model_info.status == ModelStatus.ERROR:
                raise RuntimeError(
                    f"Model {model_name} failed to load: {model_info.error}"
                )
            else:
                raise RuntimeError(
                    f"Model {model_name} is not ready yet (status: {model_info.status.value}). "
                    f"Use get_or_load_model() to load it automatically."
                )
        
        model_info.last_used = time.time()
        model_info.use_count += 1
        return model_info.model
    
    async def wait_for_model(
        self, 
        model_name: str, 
        timeout: float = 300,
        check_interval: float = 1.0
    ) -> Any:
        """
        Wait for a model to be ready and return it (DEPRECATED - use get_or_load_model()).
        
        This is kept for backward compatibility but get_or_load_model() is preferred.
        
        Args:
            model_name: "concept", "relationship", "attribute", or "naming"
            timeout: Maximum time to wait in seconds
            check_interval: How often to check status (seconds)
            
        Returns:
            The loaded model instance
        """
        logger.warning(
            f"wait_for_model() is deprecated. Use 'await model_mgr.get_or_load_model(\"{model_name}\")' instead."
        )
        return await self.get_or_load_model(model_name)
    
    def get_all_statuses(self) -> Dict[str, str]:
        """
        Get status of all models.
        
        Returns:
            Dict mapping model name to status string
        """
        return {
            name: info.status.value
            for name, info in self._models.items()
        }
    
    def are_all_ready(self) -> bool:
        """
        Check if all initialized models are ready.
        
        Returns:
            True if all models that were configured are ready
        """
        for name, config in self._config.items():
            if config.get("model_path"):  # Only check models that were configured
                if not self.is_ready(name):
                    return False
        return True
    
    async def wait_for_all_models(
        self, 
        timeout: float = 600,
        check_interval: float = 2.0
    ):
        """
        Wait for all models to be ready.
        
        Args:
            timeout: Maximum time to wait in seconds
            check_interval: How often to check status (seconds)
            
        Raises:
            TimeoutError: If models don't load within timeout
        """
        import time
        
        start_time = time.time()
        model_names = [
            name for name, config in self._config.items()
            if config.get("model_path")
        ]
        
        logger.info(f"Waiting for models to load: {', '.join(model_names)}")
        
        while not self.are_all_ready():
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed >= timeout:
                statuses = self.get_all_statuses()
                raise TimeoutError(
                    f"Models did not load within {timeout} seconds. "
                    f"Current statuses: {statuses}"
                )
            
            # Log progress
            if int(elapsed) % 10 == 0:  # Every 10 seconds
                statuses = self.get_all_statuses()
                logger.info(f"Model loading progress: {statuses}")
            
            await asyncio.sleep(check_interval)
        
        logger.info("All models loaded successfully!")
    
    def unload_all_models(self):
        """Unload all models and free GPU memory."""
        logger.info("Unloading all models...")
        
        for name, model_info in self._models.items():
            if model_info.model is not None:
                try:
                    logger.info(f"Unloading {name} model...")
                    if hasattr(model_info.model, 'unload_model'):
                        model_info.model.unload_model()
                    del model_info.model
                    model_info.model = None
                    model_info.status = ModelStatus.NOT_LOADED
                except Exception as e:
                    logger.error(f"Error unloading {name} model: {e}")
        
        # Clear GPU memory
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                import gc
                gc.collect()
                logger.info("GPU memory cleared")
        except Exception as e:
            logger.error(f"Error clearing GPU memory: {e}")
        
        self._initialized = False
        logger.info("All models unloaded")
    
    def __del__(self):
        """Cleanup when manager is destroyed."""
        self.unload_all_models()


# Convenience function to get the global instance
def get_model_manager() -> ModelManager:
    """Get the global ModelManager instance."""
    return ModelManager.get_instance()
