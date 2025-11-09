"""Main application entry point."""

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os

from app.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import AppException
from app.api.routes import api_router
from app.models.common import ErrorResponse
from app.db.session import init_db

# Setup logging
setup_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Log level: {settings.log_level}")
    
    # Initialize metadata database
    try:
        init_db()
        logger.info(f"Metadata database initialized at {settings.METADATA_DATABASE_URL}")
    except Exception as e:
        logger.error(f"Failed to initialize metadata database: {str(e)}")
        raise
    
        # Initialize AI model manager
    try:
        from app.core.model_startup import initialize_models_on_startup
        await initialize_models_on_startup(
            base_model_path="Qwen/Qwen3-14B",
            concept_adapter_path="/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_concepts_20251019163410/best",
            relationship_adapter_path="/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_relationships_with_concepts_20251102170240/best",
            attribute_adapter_path="/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_attributes_20251029135113/best",
            naming_adapter_path="/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_concepts_20251019163410/best",
            gpu_memory_utilization=0.75,  # Reduced to leave room for KV cache
            max_model_len=8192,  # Limit context length to save memory
            tensor_parallel_size=1,
            auto_unload=False,  # Base model stays loaded, adapters are swapped
        )
        logger.info("AI model manager configured successfully")
    except Exception as e:
        logger.error(f"Failed to configure AI models: {str(e)}", exc_info=True)
        # Re-raise to prevent app startup with broken model config
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")
    
    # Cleanup AI models
    try:
        from app.core.model_startup import shutdown_models
        await shutdown_models()
        logger.info("AI models cleaned up")
    except Exception as e:
        logger.error(f"Error during model cleanup: {str(e)}")
    
    # TODO: Cleanup other resources, close connections, etc.


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_credentials,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)


# Exception handlers
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions."""
    logger.error(
        f"Application error: {exc.error_code} - {exc.message}",
        extra={"details": exc.details},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.error_code,
            message=exc.message,
            details=exc.details if exc.details else None,
        ).model_dump(exclude_none=True),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.exception("Unexpected error occurred", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="InternalServerError",
            message="An unexpected error occurred. Please try again later.",
        ).model_dump(),
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
    }


# Include API routes
app.include_router(api_router)


# Run server directly with python -m app.main
if __name__ == "__main__":
    os.environ["CUDA_VISIBLE_DEVICES"] = "0"
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
