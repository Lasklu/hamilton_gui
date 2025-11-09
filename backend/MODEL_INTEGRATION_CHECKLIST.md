# Model Manager Integration Checklist

## ✅ Setup Steps

### 1. Core Files (Already Created)
- [x] `app/services/model_manager.py` - Model manager singleton
- [x] `app/core/model_startup.py` - Startup/shutdown functions
- [x] `app/api/routes/models.py` - Status endpoints
- [x] `app/services/concept_service.py` - Updated to use model manager

### 2. Configuration

#### Option A: Environment Variables (Recommended)

Create a `.env` file in `/backend/`:

```bash
# Concept extraction model
CONCEPT_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
CONCEPT_ADAPTER_PATH=/path/to/concept/lora/adapter

# Relationship extraction model (can be same base model, different adapter)
RELATIONSHIP_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
RELATIONSHIP_ADAPTER_PATH=/path/to/relationship/lora/adapter

# Attribute extraction model
ATTRIBUTE_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
ATTRIBUTE_ADAPTER_PATH=/path/to/attribute/lora/adapter
```

#### Option B: Direct Configuration

Edit your main application file to pass paths directly:

```python
await initialize_models_on_startup(
    concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    concept_adapter_path="/path/to/concept/adapter",
    # ... more models
)
```

### 3. Update Your FastAPI Application

Find your main FastAPI app file (likely `app/main.py` or `backend/main.py`) and add:

```python
from app.core.model_startup import initialize_models_on_startup, shutdown_models

@app.on_event("startup")
async def startup_event():
    """Initialize models on startup."""
    await initialize_models_on_startup(
        gpu_memory_utilization=0.3,  # Adjust based on your GPU
        tensor_parallel_size=1,      # Number of GPUs for parallelism
    )

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup models on shutdown."""
    await shutdown_models()
```

### 4. Add Model Status Routes

In your main FastAPI app, add the status router:

```python
from app.api.routes.models import router as models_router

app.include_router(models_router, prefix="/api")
```

This gives you:
- `GET /api/models/status` - All models status
- `GET /api/models/status/{model_name}` - Single model status
- `GET /api/models/ready` - Check if all ready
- `POST /api/models/unload` - Unload all models

### 5. Update Relationship Service (if you have one)

Create or update `app/services/relationship_service.py`:

```python
from app.services.model_manager import get_model_manager

class RelationshipService:
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_relationships(self, concepts):
        model = await self.model_manager.wait_for_model("relationship", timeout=300)
        
        prompt = [
            {"role": "system", "content": "Extract relationships..."},
            {"role": "user", "content": f"Concepts: {concepts}"}
        ]
        
        result = model.generate_modeling(prompt)
        return result
```

### 6. Update Attribute Service (if you have one)

Create or update `app/services/attribute_service.py`:

```python
from app.services.model_manager import get_model_manager

class AttributeService:
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_attributes(self, concept):
        model = await self.model_manager.wait_for_model("attribute", timeout=300)
        
        prompt = [
            {"role": "system", "content": "Extract attributes..."},
            {"role": "user", "content": f"Concept: {concept}"}
        ]
        
        result = model.generate_modeling(prompt)
        return result
```

## 🔧 Configuration Options

### GPU Memory Settings

Adjust based on your setup:

```python
# Single GPU with 24GB VRAM
# 3 models × 30% = 90% usage (safe)
gpu_memory_utilization=0.3

# Single GPU with 40GB VRAM or 2 GPUs
# Can use more memory
gpu_memory_utilization=0.4

# Multiple GPUs with tensor parallelism
tensor_parallel_size=2  # Use 2 GPUs per model
gpu_memory_utilization=0.45
```

### Model Paths

You can specify:
- **HuggingFace model IDs**: `"Qwen/Qwen2.5-14B-Instruct"`
- **Local paths**: `"/path/to/local/model"`
- **Adapter paths**: `"/path/to/lora/adapter"` (optional)

### Using Same Model for All Tasks

If you only have one model/adapter for all tasks:

```bash
# .env
CONCEPT_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
CONCEPT_ADAPTER_PATH=/path/to/single/adapter

# Leave others empty or use same paths
RELATIONSHIP_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
RELATIONSHIP_ADAPTER_PATH=/path/to/single/adapter

ATTRIBUTE_MODEL_PATH=Qwen/Qwen2.5-14B-Instruct
ATTRIBUTE_ADAPTER_PATH=/path/to/single/adapter
```

## 🚀 Testing

### 1. Start Your Application

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Watch the logs for model loading messages:

```
[FastLocalModel] Loading model with vLLM from Qwen/Qwen2.5-14B-Instruct...
[concept] Starting model load...
[relationship] Starting model load...
[attribute] Starting model load...
```

### 2. Check Model Status

```bash
# Check all models
curl http://localhost:8000/api/models/status

# Expected response while loading:
{
  "concept": "loading",
  "relationship": "loading",
  "attribute": "loading"
}

# Expected response when ready:
{
  "concept": "ready",
  "relationship": "ready",
  "attribute": "ready"
}
```

### 3. Check Individual Model

```bash
curl http://localhost:8000/api/models/status/concept

# Response:
{
  "name": "concept",
  "status": "ready",
  "is_ready": true,
  "error": null
}
```

### 4. Test Concept Extraction

```bash
curl -X POST http://localhost:8000/api/databases/1/concepts/generate

# If model not ready yet:
# API will wait for model to load (up to 5 minutes)

# If model is ready:
# Concept generation will start immediately
```

## 📊 Frontend Integration

### Show Loading Status

Poll the status endpoint from your frontend:

```typescript
// In your frontend code
const checkModelStatus = async () => {
  const response = await fetch('/api/models/status');
  const statuses = await response.json();
  
  // Show loading indicator if any model is still loading
  const isLoading = Object.values(statuses).some(s => s === 'loading');
  
  if (isLoading) {
    showMessage("AI models are loading, please wait...");
  } else {
    showMessage("All models ready!");
  }
};

// Poll every 5 seconds until ready
const interval = setInterval(async () => {
  await checkModelStatus();
  
  const response = await fetch('/api/models/ready');
  const { all_ready } = await response.json();
  
  if (all_ready) {
    clearInterval(interval);
  }
}, 5000);
```

## 🐛 Troubleshooting

### Issue: ImportError for FastLocalModel

**Solution**: Make sure the import path in `model_startup.py` is correct:

```python
# Update this line based on where you placed FastLocalModel
from hamilton.pipeline.models.fast_local_model import FastLocalModel
```

### Issue: Models Not Loading

**Check**:
1. Environment variables are set correctly
2. Model paths exist
3. GPU has enough memory
4. Check logs for error messages

```python
# Check status
curl http://localhost:8000/api/models/status/concept

# Look for error field
{
  "name": "concept",
  "status": "error",
  "is_ready": false,
  "error": "CUDA out of memory"  // <-- error message here
}
```

### Issue: Slow Loading

**Solutions**:
- Use smaller models
- Reduce `gpu_memory_utilization`
- Enable tensor parallelism with multiple GPUs
- Check if models are downloading from HuggingFace (first time only)

### Issue: Out of Memory

**Solutions**:
1. Reduce GPU memory per model:
   ```python
   gpu_memory_utilization=0.25  # Use less memory
   ```

2. Load fewer models:
   ```python
   # Only load concept model
   await initialize_models_on_startup(
       concept_model_path="...",
       # Don't specify relationship_model_path or attribute_model_path
   )
   ```

3. Use quantization (if supported by your model)

## 📝 Next Steps

1. ✅ Verify all files are created
2. ✅ Configure environment variables or direct paths
3. ✅ Update your main FastAPI app with startup/shutdown events
4. ✅ Add model status routes to your API
5. ✅ Test model loading by starting your application
6. ✅ Update any other services (relationship, attribute) to use model manager
7. ✅ Integrate frontend polling for model status
8. ✅ Test concept extraction with loaded models

## 📚 Reference Files

- `MODEL_MANAGER_README.md` - Complete documentation
- `EXAMPLE_MODEL_USAGE.py` - Usage examples
- `app/services/model_manager.py` - Model manager code
- `app/core/model_startup.py` - Startup configuration
- `app/api/routes/models.py` - Status API endpoints
- `app/services/concept_service.py` - Updated service example

## 🎉 Done!

Your model management system is ready! The models will:
- ✅ Load once at startup
- ✅ Load in parallel (background threads)
- ✅ Be reused across all requests
- ✅ Show loading status to users
- ✅ Automatically wait if not ready yet
- ✅ Clean up properly on shutdown
