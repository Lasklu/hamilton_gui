# Context Manager Usage for Limited GPU Memory

## 🎯 Problem

When you have **limited GPU memory** and multiple models (concept, relationship, attribute), you can't keep all models loaded simultaneously. The solution is to use a **context manager pattern** that automatically:

1. Loads the model when you need it
2. Uses it for your task
3. **Unloads it immediately** to free GPU memory

## ✨ Solution: `with model_mgr.use_model()`

The `use_model()` context manager automatically handles loading and unloading:

```python
from app.services.model_manager import get_model_manager

model_mgr = get_model_manager()

# Model is loaded, used, and automatically unloaded
with model_mgr.use_model("concept") as model:
    result = model.generate_modeling(prompt)
# GPU memory is freed here!

# Load a different model
with model_mgr.use_model("relationship") as model:
    result = model.generate_modeling(prompt)
# GPU memory is freed here too!
```

## 📊 Configuration

### Enable Auto-Unload (Default)

```python
# In your startup code
await initialize_models_on_startup(
    concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    concept_adapter_path="/path/to/adapter",
    gpu_memory_utilization=0.9,  # Can use more since only 1 model at a time
    auto_unload=True,  # Models unload after use (DEFAULT)
)
```

### Disable Auto-Unload (Keep Models Loaded)

If you have enough GPU memory:

```python
await initialize_models_on_startup(
    concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    gpu_memory_utilization=0.3,  # Use less since multiple models may be loaded
    auto_unload=False,  # Keep models in memory
)
```

## 🔧 Usage in Services

### ConceptService (Updated)

Your `concept_service.py` now uses the context manager:

```python
async def _generate_concepts(
    self,
    cluster_id: int,
    table_names: List[str],
    database_id: str,
    existing_concepts: Optional[List[Concept]],
    progress_callback=None
) -> List[Concept]:
    """Generate concepts using AI model with automatic unloading."""
    
    # Build prompt
    prompt = self._build_concept_prompt(table_names, existing_concepts)
    
    # Use model with context manager
    with self.model_manager.use_model("concept") as concept_model:
        # Model is loaded here
        ai_response = concept_model.generate_modeling(prompt)
        # Process response...
    
    # Model is automatically unloaded here!
    
    # Parse and return
    concepts = self._parse_ai_response(ai_response, cluster_id)
    return concepts
```

### RelationshipService (Example)

```python
from app.services.model_manager import get_model_manager

class RelationshipService:
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_relationships(self, concepts):
        """Extract relationships with automatic model unloading."""
        
        prompt = [
            {"role": "system", "content": "Extract relationships..."},
            {"role": "user", "content": f"Concepts: {concepts}"}
        ]
        
        # Load, use, and unload automatically
        with self.model_manager.use_model("relationship") as model:
            result = model.generate_modeling(prompt)
        
        # GPU memory freed here
        return result
```

### AttributeService (Example)

```python
from app.services.model_manager import get_model_manager

class AttributeService:
    def __init__(self):
        self.model_manager = get_model_manager()
    
    async def extract_attributes(self, concept):
        """Extract attributes with automatic model unloading."""
        
        prompt = [
            {"role": "system", "content": "Extract attributes..."},
            {"role": "user", "content": f"Concept: {concept}"}
        ]
        
        with self.model_manager.use_model("attribute") as model:
            result = model.generate_modeling(prompt)
        
        return result
```

## 🔄 Sequential Pipeline with Auto-Unloading

Process concepts → relationships → attributes with automatic memory management:

```python
async def process_database_sequentially():
    """
    Process database through full pipeline.
    Each model loads, runs, and unloads automatically.
    """
    model_mgr = get_model_manager()
    
    # Step 1: Extract concepts
    with model_mgr.use_model("concept") as concept_model:
        concepts = concept_model.generate_modeling(concept_prompt)
    # Concept model unloaded, memory freed
    
    # Step 2: Extract relationships
    with model_mgr.use_model("relationship") as relationship_model:
        relationships = relationship_model.generate_modeling(rel_prompt)
    # Relationship model unloaded, memory freed
    
    # Step 3: Extract attributes
    with model_mgr.use_model("attribute") as attribute_model:
        attributes = attribute_model.generate_modeling(attr_prompt)
    # Attribute model unloaded, memory freed
    
    return {
        "concepts": concepts,
        "relationships": relationships,
        "attributes": attributes
    }
```

## ⚡ Performance Comparison

### Before (All Models Loaded)

```
GPU Memory Usage:
┌─────────────────┬──────────┐
│ Concept Model   │ 8 GB     │
│ Relation Model  │ 8 GB     │
│ Attribute Model │ 8 GB     │
├─────────────────┼──────────┤
│ TOTAL           │ 24 GB    │ ❌ Doesn't fit on single GPU!
└─────────────────┴──────────┘
```

### After (Auto-Unload with Context Manager)

```
GPU Memory Usage:
┌─────────────────┬──────────┐
│ Active Model    │ 8 GB     │
├─────────────────┼──────────┤
│ TOTAL           │ 8 GB     │ ✅ Fits on single GPU!
└─────────────────┴──────────┘

Timeline:
1. Load concept model    → Use → Unload
2. Load relationship     → Use → Unload  
3. Load attribute        → Use → Unload
```

## 🆚 When to Use Each Approach

### Use Context Manager (Recommended for Limited GPU)

```python
# ✅ Use this when:
# - Limited GPU memory
# - Multiple models to run
# - Models used infrequently
# - Memory efficiency is priority

with model_mgr.use_model("concept") as model:
    result = model.generate_modeling(prompt)
```

**Pros:**
- ✅ Minimal GPU memory usage
- ✅ Can run larger models
- ✅ Automatic cleanup
- ✅ No memory leaks

**Cons:**
- ⏱️ Loading overhead per use (5-30 seconds)
- ⏱️ Slower for frequent calls

### Keep Models Loaded (For Sufficient GPU Memory)

```python
# Use this when:
# - Sufficient GPU memory for all models
# - Frequent model calls
# - Speed is priority

model = await model_mgr.get_or_load_model("concept")
result = model.generate_modeling(prompt)
# Model stays loaded
```

**Pros:**
- ⚡ Fast subsequent calls
- ⚡ No loading overhead

**Cons:**
- 💾 High GPU memory usage
- 💾 All models stay loaded

## 🎛️ Configuration Strategies

### Strategy 1: Single GPU, Limited Memory (8-16 GB)

```python
await initialize_models_on_startup(
    concept_model_path="Qwen/Qwen2.5-7B-Instruct",  # Use smaller model
    relationship_model_path="Qwen/Qwen2.5-7B-Instruct",
    attribute_model_path="Qwen/Qwen2.5-7B-Instruct",
    gpu_memory_utilization=0.85,  # Can use more (only 1 at a time)
    auto_unload=True,  # Essential for limited memory
)
```

### Strategy 2: Single GPU, Good Memory (24-40 GB)

```python
await initialize_models_on_startup(
    concept_model_path="Qwen/Qwen2.5-14B-Instruct",
    relationship_model_path="Qwen/Qwen2.5-14B-Instruct",
    attribute_model_path="Qwen/Qwen2.5-14B-Instruct",
    gpu_memory_utilization=0.30,  # 3 models × 30% = 90%
    auto_unload=False,  # Keep loaded for speed
)
```

### Strategy 3: Multiple GPUs

```python
await initialize_models_on_startup(
    concept_model_path="Qwen/Qwen2.5-32B-Instruct",
    relationship_model_path="Qwen/Qwen2.5-32B-Instruct",
    attribute_model_path="Qwen/Qwen2.5-32B-Instruct",
    gpu_memory_utilization=0.40,
    tensor_parallel_size=2,  # Use 2 GPUs per model
    auto_unload=True,  # Still good practice
)
```

## 🔍 Debugging

### Check If Model Was Unloaded

```python
from app.services.model_manager import ModelStatus

model_mgr = get_model_manager()

# Before use
print(model_mgr.get_status("concept"))
# Output: ModelStatus.NOT_LOADED or ModelStatus.UNLOADED

# During use (in context manager)
with model_mgr.use_model("concept") as model:
    print(model_mgr.get_status("concept"))
    # Output: ModelStatus.READY
    
# After use
print(model_mgr.get_status("concept"))
# Output: ModelStatus.UNLOADED (if auto_unload=True)
```

### Monitor GPU Memory

```python
import torch

def print_gpu_memory():
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            allocated = torch.cuda.memory_allocated(i) / 1024**3
            reserved = torch.cuda.memory_reserved(i) / 1024**3
            print(f"GPU {i}: {allocated:.2f} GB allocated, {reserved:.2f} GB reserved")

# Before loading
print_gpu_memory()

with model_mgr.use_model("concept") as model:
    print("During use:")
    print_gpu_memory()
    result = model.generate_modeling(prompt)

print("After unload:")
print_gpu_memory()
```

## 🚨 Common Pitfalls

### ❌ Don't: Store Model Reference Outside Context

```python
# BAD - Model is unloaded when exiting context!
with model_mgr.use_model("concept") as model:
    stored_model = model

# Model is now unloaded, this will fail:
result = stored_model.generate_modeling(prompt)  # ERROR!
```

### ✅ Do: Use Model Inside Context

```python
# GOOD - Use model before context exits
with model_mgr.use_model("concept") as model:
    result = model.generate_modeling(prompt)
    # Process result here
    processed = parse_result(result)

# Use processed result outside
return processed
```

### ❌ Don't: Nest Same Model

```python
# BAD - Can cause issues
with model_mgr.use_model("concept") as model1:
    with model_mgr.use_model("concept") as model2:  # Same model!
        # Problematic
```

### ✅ Do: Use Different Models

```python
# GOOD - Different models in sequence
with model_mgr.use_model("concept") as concept_model:
    concepts = concept_model.generate_modeling(prompt1)

with model_mgr.use_model("relationship") as rel_model:
    relationships = rel_model.generate_modeling(prompt2)
```

## 📚 Summary

**For Limited GPU Memory (Recommended):**

```python
# Configuration
await initialize_models_on_startup(
    concept_model_path="path/to/model",
    gpu_memory_utilization=0.9,  # High since only 1 model at a time
    auto_unload=True,  # Auto-unload after use
)

# Usage
with model_mgr.use_model("concept") as model:
    result = model.generate_modeling(prompt)
# Model automatically unloaded here
```

**Benefits:**
- ✅ Only one model in GPU memory at a time
- ✅ Can use larger models or higher memory settings
- ✅ Automatic cleanup prevents memory leaks
- ✅ Works on GPUs with limited memory (8-16 GB)

**Trade-off:**
- ⏱️ Loading overhead (5-30 seconds per model load)
- But worth it for memory efficiency!
