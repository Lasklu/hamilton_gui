# LoRA Adapter Swapping Quick Reference

## Overview
This system uses a single base model with multiple LoRA adapters that can be swapped instantly without reloading the base model.

## Configuration

### 1. Environment Variables (.env)

```bash
# Base model (loaded once, kept in memory)
# This is configured in model_manager initialization

# LoRA adapters (lightweight, ~100MB each)
CONCEPT_ADAPTER_PATH=/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_concepts_20251019163410/best
NAMING_ADAPTER_PATH=/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_naming_XXXXXX/best
```

### 2. Model Manager Initialization (in `app/main.py` or startup)

```python
from app.services.model_manager import get_model_manager

model_manager = get_model_manager()
await model_manager.configure_models(
    base_model_path="Qwen/Qwen2.5-14B-Instruct",
    concept_adapter_path=settings.CONCEPT_ADAPTER_PATH,
    naming_adapter_path=settings.NAMING_ADAPTER_PATH,
    # Optional: add more adapters
    # relationship_adapter_path=settings.RELATIONSHIP_ADAPTER_PATH,
    # attribute_adapter_path=settings.ATTRIBUTE_ADAPTER_PATH,
    auto_unload=False,  # Keep base model loaded
    gpu_memory_utilization=0.75,
    tensor_parallel_size=1,
)
```

## Usage Patterns

### Pattern 1: Via Service (Recommended)

```python
# In concept_service.py or similar
with self.model_manager.use_model("concept") as model:
    # Model automatically has "concept" adapter active
    result = model.generate_modeling(prompt)

# Adapter swapping happens inside extract_concepts_from_cluster automatically
```

### Pattern 2: Direct Usage

```python
from app.services.model_manager import get_model_manager

model_mgr = get_model_manager()

# Use concept adapter
with model_mgr.use_model("concept") as model:
    concepts = model.generate_modeling(concept_prompt)

# Use naming adapter (instant switch, no reload!)
with model_mgr.use_model("naming") as model:
    names = model.generate_text(naming_prompt)
```

### Pattern 3: Manual Adapter Control (Advanced)

```python
# Get base model
with model_mgr.use_model("base") as base_model:
    # Manually switch adapters
    base_model.set_lora_adapter("concept")
    result1 = base_model.generate_modeling(prompt1)
    
    base_model.set_lora_adapter("naming")
    result2 = base_model.generate_text(prompt2)
    
    # Check which adapter is active
    print(base_model.get_active_adapter())  # "naming"
    
    # List all loaded adapters
    print(base_model.list_adapters())  # ["concept", "naming"]
```

## How It Works

### First Request (Cold Start)
1. API receives first concept extraction request
2. ModelManager loads base model into GPU (~30 seconds)
3. All LoRA adapters are registered with vLLM
4. Adapter switches to "concept"
5. Concepts are extracted
6. Adapter switches to "naming" (instant!)
7. Concepts are named
8. Base model stays loaded

### Subsequent Requests (Warm)
1. API receives another request
2. Base model already loaded ✓
3. Just switch adapters (instant!)
4. Process request
5. Return results

## Memory Usage

```
Component                   Memory
──────────────────────────────────
Base Model (Qwen 14B)       ~35 GB
Concept Adapter             ~100 MB
Naming Adapter              ~100 MB
Relationship Adapter        ~100 MB (future)
Attribute Adapter           ~100 MB (future)
──────────────────────────────────
Total                       ~35.4 GB

Available on GPU:           48 GB
Headroom:                   ~12.6 GB ✓
```

## Monitoring

### Check Model Status
```python
model_mgr = get_model_manager()
status = await model_mgr.get_model_status("base")
print(f"Status: {status['status']}")
print(f"Use count: {status['use_count']}")
```

### Check Active Adapter
```python
with model_mgr.use_model("base") as base_model:
    active = base_model.get_active_adapter()
    print(f"Active adapter: {active}")
    
    all_adapters = base_model.list_adapters()
    print(f"Available: {all_adapters}")
```

### GPU Memory
```python
import torch
allocated = torch.cuda.memory_allocated(0) / 1024**3
print(f"GPU memory used: {allocated:.2f} GB")
```

## Troubleshooting

### OOM Error on First Load
```
Error: Free memory (5.89 GB) < desired (35.65 GB)
```

**Solution**: Reduce `gpu_memory_utilization`:
```python
await model_manager.configure_models(
    ...,
    gpu_memory_utilization=0.70,  # Try 0.70 or 0.65
)
```

### Adapter Not Found
```
Error: Adapter 'naming' not loaded
```

**Solution**: Check adapter was configured:
```python
await model_manager.configure_models(
    ...,
    naming_adapter_path="/correct/path/to/adapter",
)
```

### Slow Adapter Switching
If adapter switches take time, check you're using vLLM with LoRA support:
```python
# Should be FastLocalModel, not LocalModel
from hamilton.pipeline.models.fast_local import FastLocalModel
```

## Best Practices

1. **Always use context managers**: `with model_mgr.use_model(...)`
2. **Don't manually unload base model**: It should stay loaded
3. **Add adapters at startup**: Don't try to add them during request handling
4. **Monitor GPU memory**: Keep headroom of 10-15% for safety
5. **Use named adapters**: Helps with debugging and logging

## Adding New Adapters

### 1. Train your new adapter
```bash
# Train a new relationship extraction adapter
python train_lora.py --task relationship --output /path/to/adapter
```

### 2. Add to config.py
```python
class Settings(BaseSettings):
    ...
    RELATIONSHIP_ADAPTER_PATH: str = "/path/to/relationship/adapter"
```

### 3. Register during startup
```python
await model_manager.configure_models(
    ...,
    relationship_adapter_path=settings.RELATIONSHIP_ADAPTER_PATH,
)
```

### 4. Use in code
```python
with model_mgr.use_model("relationship") as model:
    relationships = model.generate_modeling(prompt)
```

## Performance Metrics

- **Base model load time**: ~30 seconds (first request only)
- **Adapter switch time**: <0.1 seconds (instant)
- **Memory overhead per adapter**: ~100 MB
- **Inference speed**: Same as single model (no overhead)
- **Supported concurrent adapters**: 4 (configurable with `max_loras`)

## References

- vLLM LoRA docs: https://docs.vllm.ai/en/latest/models/lora.html
- FastLocalModel implementation: `hamilton/pipeline/models/fast_local.py`
- ModelManager implementation: `app/services/model_manager.py`
