# AI Model Management System

This system provides efficient background loading and management of multiple AI models (concept, relationship, and attribute extraction) using your `FastLocalModel` with vLLM.

## 📋 Overview

The model management system solves these problems:

1. **No Repeated Loading**: Models are loaded once at startup and reused across all requests
2. **Background Loading**: Models load in parallel while your API server starts
3. **Status Tracking**: Know when models are ready or still loading
4. **Automatic Waiting**: Services automatically wait for models if they're not ready yet
5. **Memory Management**: Proper cleanup and GPU memory management

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Application                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    on_event("startup")
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            initialize_models_on_startup()                    │
│  - Reads config (env vars or parameters)                     │
│  - Starts background threads for each model                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      ModelManager                            │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Concept Model  │  │Relationship M. │  │ Attribute M.  │ │
│  │   (loading)    │  │   (loading)    │  │   (loading)   │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
│         │                    │                    │          │
│    Thread 1             Thread 2             Thread 3        │
└─────────────────────────────────────────────────────────────┘
                              │
                      (Models load in parallel)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ConceptService / Other Services                 │
│  - get_model_manager()                                       │
│  - wait_for_model("concept") → blocks until ready            │
│  - model.generate_modeling(prompt) → use model               │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
# Concept extraction model
CONCEPT_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
CONCEPT_ADAPTER_PATH=/path/to/concept/adapter

# Relationship extraction model
RELATIONSHIP_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
RELATIONSHIP_ADAPTER_PATH=/path/to/relationship/adapter

# Attribute extraction model
ATTRIBUTE_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
ATTRIBUTE_ADAPTER_PATH=/path/to/attribute/adapter
```

### 2. Initialize in FastAPI Startup

Update your `main.py` or main application file:

```python
from fastapi import FastAPI
from app.core.model_startup import initialize_models_on_startup, shutdown_models

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    """Load models in background when application starts."""
    await initialize_models_on_startup(
        gpu_memory_utilization=0.3,  # Use 30% GPU memory per model
        tensor_parallel_size=1,
    )

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup models when application shuts down."""
    await shutdown_models()
```

### 3. Use Models in Your Services

Update your services to use the model manager:

```python
from app.services.model_manager import get_model_manager

class ConceptService:
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_concepts(self, table_names: list[str]):
        # Wait for model to be ready (blocks if still loading)
        model = await self.model_manager.wait_for_model("concept", timeout=300)
        
        # Use the model
        prompt = [
            {"role": "system", "content": "Extract concepts..."},
            {"role": "user", "content": f"Tables: {', '.join(table_names)}"}
        ]
        
        result = model.generate_modeling(prompt)
        return result
```

## 📊 Model Status Endpoint

Add an endpoint to check model loading status:

```python
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
```

Your frontend can poll this endpoint to show loading progress.

## 🔧 API Reference

### ModelManager

#### `get_instance()` (classmethod)
Get the singleton ModelManager instance.

```python
model_mgr = ModelManager.get_instance()
# or use the convenience function
model_mgr = get_model_manager()
```

#### `initialize_models(...)`
Initialize models with background loading.

```python
await model_mgr.initialize_models(
    concept_model_path="path/to/model",
    concept_adapter_path="path/to/adapter",
    relationship_model_path="path/to/model",
    # ... more models
    gpu_memory_utilization=0.3,
    tensor_parallel_size=1,
)
```

#### `get_status(model_name: str) -> ModelStatus`
Get the loading status of a specific model.

```python
status = model_mgr.get_status("concept")
# Returns: ModelStatus.NOT_LOADED | LOADING | READY | ERROR
```

#### `is_ready(model_name: str) -> bool`
Check if a model is ready for use.

```python
if model_mgr.is_ready("concept"):
    model = model_mgr.get_model("concept")
```

#### `get_model(model_name: str) -> FastLocalModel`
Get a loaded model (raises if not ready).

```python
try:
    model = model_mgr.get_model("concept")
except RuntimeError as e:
    print(f"Model not ready: {e}")
```

#### `wait_for_model(model_name: str, timeout: float) -> FastLocalModel`
Wait for a model to be ready and return it.

```python
# Blocks until model is ready or timeout
model = await model_mgr.wait_for_model("concept", timeout=300)
```

#### `get_all_statuses() -> Dict[str, str]`
Get status of all models.

```python
statuses = model_mgr.get_all_statuses()
# {"concept": "ready", "relationship": "loading", "attribute": "ready"}
```

#### `are_all_ready() -> bool`
Check if all initialized models are ready.

```python
if model_mgr.are_all_ready():
    print("All models loaded!")
```

#### `wait_for_all_models(timeout: float)`
Wait for all models to be ready.

```python
await model_mgr.wait_for_all_models(timeout=600)
```

#### `unload_all_models()`
Unload all models and free GPU memory.

```python
model_mgr.unload_all_models()
```

## 💡 Usage Patterns

### Pattern 1: Check and Get Immediately

```python
if model_mgr.is_ready("concept"):
    model = model_mgr.get_model("concept")
    result = model.generate_modeling(prompt)
else:
    return {"error": "Model not ready yet"}
```

### Pattern 2: Wait for Model

```python
# Blocks until ready or timeout
model = await model_mgr.wait_for_model("concept", timeout=300)
result = model.generate_modeling(prompt)
```

### Pattern 3: With Error Handling

```python
try:
    model = await model_mgr.wait_for_model("concept", timeout=300)
    result = model.generate_modeling(prompt)
except TimeoutError:
    return {"error": "Model loading timeout"}
except RuntimeError as e:
    return {"error": f"Model failed: {e}"}
```

### Pattern 4: Sequential Pipeline

```python
# Wait for all models first
await model_mgr.wait_for_all_models(timeout=600)

# Then use them sequentially
concept_model = model_mgr.get_model("concept")
concepts = concept_model.generate_modeling(concept_prompt)

relationship_model = model_mgr.get_model("relationship")
relationships = relationship_model.generate_modeling(rel_prompt)

attribute_model = model_mgr.get_model("attribute")
attributes = attribute_model.generate_modeling(attr_prompt)
```

## 🎯 Best Practices

### 1. Configure GPU Memory

Each model uses a portion of GPU memory. If you have 3 models and 1 GPU:

```python
# Conservative: 3 models × 30% = 90% GPU usage
gpu_memory_utilization=0.3

# Aggressive: 3 models × 40% = 120% (will use system RAM for overflow)
gpu_memory_utilization=0.4
```

### 2. Use Timeouts

Always set reasonable timeouts when waiting for models:

```python
# For initial load: 5 minutes
model = await model_mgr.wait_for_model("concept", timeout=300)

# For subsequent calls: use is_ready() check instead
```

### 3. Handle Loading State in UI

Show loading indicators while models are loading:

```python
@app.get("/api/concepts/generate")
async def generate_concepts():
    status = model_mgr.get_status("concept")
    
    if status == ModelStatus.LOADING:
        return {
            "status": "loading",
            "message": "Model is still loading, please wait..."
        }
    
    model = model_mgr.get_model("concept")
    # ... use model
```

### 4. Same Model for Multiple Tasks

If you want to use the same model for all three tasks:

```python
await model_mgr.initialize_models(
    concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    concept_adapter_path="/path/to/concept/adapter",
    relationship_model_path="Qwen/Qwen2.5-14B-Instruct",
    relationship_adapter_path="/path/to/relationship/adapter",
    attribute_model_path="Qwen/Qwen2.5-14B-Instruct",
    attribute_adapter_path="/path/to/attribute/adapter",
    gpu_memory_utilization=0.3,
)
```

Each will have its own LoRA adapter but share the base model architecture.

### 5. Single Model for All Tasks

If you only need one model:

```python
await model_mgr.initialize_models(
    concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    concept_adapter_path="/path/to/adapter",
    # Leave other models as None
    gpu_memory_utilization=0.9,  # Can use more GPU since only 1 model
)
```

## 🐛 Troubleshooting

### Models Take Too Long to Load

- Increase timeout: `wait_for_model("concept", timeout=600)`
- Check GPU memory: Models might be swapping to CPU
- Use smaller `gpu_memory_utilization` per model
- Enable tensor parallelism: `tensor_parallel_size=2`

### Out of GPU Memory

- Reduce `gpu_memory_utilization` (try 0.25 or 0.2)
- Load fewer models at once
- Use smaller models or quantization
- Enable CPU offloading in your model config

### Model Fails to Load

Check the error:

```python
status = model_mgr.get_status("concept")
if status == ModelStatus.ERROR:
    model_info = model_mgr._models["concept"]
    print(f"Error: {model_info.error}")
```

### Model Not Initialized

Make sure `initialize_models_on_startup()` is called in your FastAPI startup event.

## 📁 File Structure

```
backend/
├── app/
│   ├── services/
│   │   ├── model_manager.py          # Main model manager
│   │   ├── concept_service.py        # Updated to use model manager
│   │   └── ...
│   └── core/
│       ├── model_startup.py          # Startup initialization
│       └── ...
├── EXAMPLE_MODEL_USAGE.py            # Usage examples
└── MODEL_MANAGER_README.md           # This file
```

## 🔗 Integration with Existing Code

Your `ConceptService` has been updated to use the model manager. The key changes:

1. **Import**: Added `from app.services.model_manager import get_model_manager`
2. **Init**: Added `self.model_manager = get_model_manager()` in `__init__`
3. **Usage**: Added model loading and waiting logic in `_generate_concepts()`

You should make similar updates to `RelationshipService` and `AttributeService` if you have them.

## 📚 See Also

- `EXAMPLE_MODEL_USAGE.py` - Complete working examples
- `concept_service.py` - Updated service implementation
- `model_startup.py` - Startup configuration
- `model_manager.py` - Core model manager code
