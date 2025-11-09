"""
API routes for checking AI model loading status.

Add these routes to your FastAPI application to monitor model loading progress.
"""

from fastapi import APIRouter
from app.services.model_manager import get_model_manager, ModelStatus
from typing import Dict, Any

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("/status")
async def get_model_status() -> Dict[str, str]:
    """
    Get the loading status of all AI models.
    
    Returns:
        Dictionary mapping model name to status:
        {
            "concept": "ready" | "loading" | "not_loaded" | "error",
            "relationship": "ready" | "loading" | "not_loaded" | "error",
            "attribute": "ready" | "loading" | "not_loaded" | "error",
            "naming": "ready" | "loading" | "not_loaded" | "error"
        }
    
    Example:
        GET /api/models/status
        
        Response:
        {
            "concept": "loading",
            "relationship": "ready",
            "attribute": "not_loaded",
            "naming": "ready"
        }
    """
    model_mgr = get_model_manager()
    return model_mgr.get_all_statuses()


@router.get("/status/{model_name}")
async def get_single_model_status(model_name: str) -> Dict[str, Any]:
    """
    Get detailed status for a specific model.
    
    Args:
        model_name: One of "concept", "relationship", "attribute", "naming"
    
    Returns:
        {
            "name": "concept",
            "status": "ready",
            "is_ready": true,
            "error": null  // or error message if status is "error"
        }
    
    Example:
        GET /api/models/status/concept
        
        Response:
        {
            "name": "concept",
            "status": "ready",
            "is_ready": true,
            "error": null
        }
    """
    model_mgr = get_model_manager()
    
    if model_name not in ["concept", "relationship", "attribute", "naming"]:
        return {
            "error": f"Unknown model: {model_name}",
            "valid_models": ["concept", "relationship", "attribute", "naming"]
        }
    
    status = model_mgr.get_status(model_name)
    is_ready = model_mgr.is_ready(model_name)
    
    # Get error message if status is ERROR
    error_msg = None
    if status == ModelStatus.ERROR:
        model_info = model_mgr._models[model_name]
        error_msg = model_info.error
    
    return {
        "name": model_name,
        "status": status.value,
        "is_ready": is_ready,
        "error": error_msg
    }


@router.get("/ready")
async def check_all_models_ready() -> Dict[str, Any]:
    """
    Check if all configured models are ready.
    
    Returns:
        {
            "all_ready": true,
            "details": {
                "concept": "ready",
                "relationship": "ready",
                "attribute": "not_loaded",  // not configured
                "naming": "ready"
            }
        }
    
    Example:
        GET /api/models/ready
        
        Response:
        {
            "all_ready": false,
            "details": {
                "concept": "loading",
                "relationship": "ready",
                "attribute": "not_loaded",
                "naming": "ready"
            }
        }
    """
    model_mgr = get_model_manager()
    
    return {
        "all_ready": model_mgr.are_all_ready(),
        "details": model_mgr.get_all_statuses()
    }


@router.post("/unload")
async def unload_all_models() -> Dict[str, str]:
    """
    Unload all models and free GPU memory.
    
    ⚠️ WARNING: This will unload all models. You'll need to restart
    the application to load them again.
    
    Returns:
        {"message": "All models unloaded"}
    
    Example:
        POST /api/models/unload
        
        Response:
        {"message": "All models unloaded"}
    """
    model_mgr = get_model_manager()
    model_mgr.unload_all_models()
    
    return {"message": "All models unloaded"}


@router.post("/load-base")
async def load_base_model() -> Dict[str, Any]:
    """
    Load the base model into GPU memory.
    
    This endpoint loads the base model if it's not already loaded.
    The base model will stay in memory for subsequent adapter switching.
    
    Returns:
        {
            "status": "success" | "already_loaded" | "error",
            "message": "Base model loaded successfully" | error message,
            "model_status": "ready" | "loading" | "error"
        }
    
    Example:
        POST /api/models/load-base
        
        Response:
        {
            "status": "success",
            "message": "Base model loaded successfully",
            "model_status": "ready"
        }
    """
    model_mgr = get_model_manager()
    
    # Check if base model is configured
    base_config = model_mgr._config.get('base')
    if not base_config or not base_config.get('model_path'):
        return {
            "status": "error",
            "message": "Base model not configured",
            "model_status": "not_loaded"
        }
    
    # Check current status
    base_status = model_mgr.get_status('base')
    
    if base_status == ModelStatus.READY:
        return {
            "status": "already_loaded",
            "message": "Base model is already loaded",
            "model_status": "ready"
        }
    
    if base_status == ModelStatus.LOADING:
        return {
            "status": "loading",
            "message": "Base model is currently loading",
            "model_status": "loading"
        }
    
    # Load the base model
    try:
        model_mgr._load_model_sync('base')
        return {
            "status": "success",
            "message": "Base model loaded successfully",
            "model_status": "ready"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to load base model: {str(e)}",
            "model_status": "error"
        }


# ===================================================================
# Add this router to your main FastAPI app:
#
# from app.api.routes.models import router as models_router
# app.include_router(models_router, prefix="/api")
#
# Then you can access:
# - GET  /api/models/status
# - GET  /api/models/status/{model_name}
# - GET  /api/models/ready
# - POST /api/models/unload
# - POST /api/models/load-base
# ===================================================================
