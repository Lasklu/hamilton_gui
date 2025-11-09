# Integration Complete - Next Steps

## ✅ What's Done

The `concept_service.py` has been updated to:

1. **Use your `extract_concepts_from_cluster` function** with the correct signature
2. **Pass the loaded model** from the model manager as a parameter
3. **Handle database connections** using `PostgresClient` 
4. **Run in async context** using `loop.run_in_executor()` to avoid blocking
5. **Auto-load and auto-unload** the model using context manager (saves GPU memory)
6. **Parse the JSON response** into `Concept` objects for the API

## 📝 Next Step: Add Import Statement

You need to add the import for your function at the **top of the file**.

Open `/home/lukas/hamilton_gui/backend/app/services/concept_service.py` and add this import:

```python
from hamilton.pipeline.concept_extraction import extract_concepts_from_cluster
```

The import is currently on **line 68** inside the function. Move it to the top imports section (around line 11).

### Current Import Section (lines 1-13):

```python
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
```

### Add This Line:

```python
from hamilton.pipeline.concept_extraction import extract_concepts_from_cluster
```

### After Adding (should look like):

```python
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
from hamilton.pipeline.concept_extraction import extract_concepts_from_cluster  # ADD THIS LINE

logger = get_logger(__name__)
```

## 🔍 How It Works

### Function Call (line 68-85):

```python
ai_response = await loop.run_in_executor(
    None,  # Use default executor
    extract_concepts_from_cluster,
    cluster_id,              # Your cluster_id parameter
    table_names,             # Your table_names parameter
    database_id,             # Your database_id parameter
    database,                # PostgresClient instance
    concept_model,           # FastLocalModel from model_manager
    None,                    # model_path (not needed)
    None,                    # adapter_path (not needed)
    False,                   # use_fast_inference (model already loaded)
    existing_concepts_dict,  # Previous concepts as dict
    None,                    # naming_model (optional)
    None,                    # naming_model_path (optional)
    True,                    # naming_enabled
    progress_callback,       # Progress updates
    False,                   # use_table_names_only
    True,                    # verbose
)
```

### Key Points:

1. **Model is already loaded** via `self.model_manager.use_model("concept")`
2. **Model is passed directly** as the `model` parameter
3. **`use_fast_inference=False`** because we're passing a loaded model instance
4. **Runs in thread pool** via `run_in_executor()` to avoid blocking async event loop
5. **Model auto-unloads** when context manager exits (saves GPU memory)

## 🧪 Testing

Once you add the import, test it:

### 1. Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### 2. Check Model Status

```bash
curl http://localhost:8000/api/models/status
```

Should show:
```json
{
  "concept": "not_loaded",
  "relationship": "not_loaded",
  "attribute": "not_loaded"
}
```

### 3. Generate Concepts

```bash
curl -X POST http://localhost:8000/api/databases/YOUR_DB_ID/concepts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "clusters": [
      {
        "clusterId": 1,
        "name": "Test Cluster",
        "tables": ["Person", "Address"]
      }
    ]
  }'
```

Should return:
```json
{
  "jobId": "some-job-id"
}
```

### 4. Check Job Progress

```bash
curl http://localhost:8000/api/jobs/some-job-id
```

You should see:
- Model loads (may take 10-30 seconds first time)
- Concepts are extracted
- Model unloads (frees GPU memory)
- Results are returned

## 🎯 Expected Behavior

### First Call:
```
1. API receives request
2. Model manager loads concept model (~10-30s)
3. Your function extracts concepts (~5-10s)
4. Model manager unloads model (frees GPU)
5. Results returned
```

### Subsequent Calls:
```
1. API receives request
2. Model manager loads concept model (~10-30s) - reloads each time
3. Your function extracts concepts (~5-10s)
4. Model manager unloads model (frees GPU)
5. Results returned
```

**Why reload each time?** With `auto_unload=True`, the model unloads after each use to save GPU memory. Perfect for limited GPU memory!

## 📊 If You Have Sufficient GPU Memory

If you want to keep models loaded between calls (faster but uses more memory):

Update `/backend/app/core/model_startup.py`:

```python
await initialize_models_on_startup(
    concept_model_path="path/to/model",
    gpu_memory_utilization=0.3,  # Use less since multiple models
    auto_unload=False,  # Keep models loaded
)
```

Then modify `concept_service.py` to use `get_or_load_model()` instead of `use_model()`:

```python
# Instead of:
with self.model_manager.use_model("concept") as concept_model:
    # ...

# Use:
concept_model = await self.model_manager.get_or_load_model("concept")
# ... use model ...
# Model stays loaded
```

## ⚠️ Troubleshooting

### Import Error

If you get:
```
ImportError: cannot import name 'extract_concepts_from_cluster'
```

**Solution:** Make sure the import path matches where your function is defined.

### Model Not Loading

If you get:
```
RuntimeError: Model concept not configured
```

**Solution:** Make sure you call `initialize_models_on_startup()` in your FastAPI app startup:

```python
@app.on_event("startup")
async def startup_event():
    await initialize_models_on_startup(
        concept_model_path="Qwen/Qwen2.5-14B-Instruct",
        concept_adapter_path="/path/to/adapter",
        auto_unload=True,
    )
```

### Progress Callback Issues

If progress callback doesn't work, your function might be calling it from a different thread. This is okay - the progress will still update, just might not be perfectly synchronized.

## ✨ Summary

**Just add one line** at the top of `concept_service.py`:

```python
from hamilton.pipeline.concept_extraction import extract_concepts_from_cluster
```

Then remove the duplicate import from inside the function (line 68).

That's it! Your concept generation is ready to go! 🚀
