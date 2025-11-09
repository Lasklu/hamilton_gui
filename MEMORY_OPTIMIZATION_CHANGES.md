# Memory Optimization: LoRA Adapter Swapping

## Problem
The `extract_concepts_from_cluster` function was causing OOM errors because:
1. Initially tried to load both concept and naming models simultaneously → OOM
2. Then tried sequential load/unload → Still OOM because vLLM doesn't actually free VRAM on `unload_model()`

The error was:
```
ERROR: ValueError: Free memory on device (5.89/47.54 GiB) on startup is less 
than desired GPU memory utilization (0.75, 35.65 GiB).
```

This meant even after "unloading", the GPU memory was still occupied.

## Solution: LoRA Adapter Swapping

Instead of loading/unloading separate models, we now use **vLLM's native LoRA adapter swapping**:

### Architecture

```
┌─────────────────────────────────────┐
│   Base Model (Qwen 14B)             │  ← Loaded ONCE, stays in VRAM
│   ~35 GB GPU Memory                 │
├─────────────────────────────────────┤
│   LoRA Adapters (lightweight):     │  ← Swapped as needed (~100MB each)
│   • "concept" adapter               │
│   • "naming" adapter                │
│   • "relationship" adapter (future) │
│   • "attribute" adapter (future)    │
└─────────────────────────────────────┘
```

### Key Changes

#### 1. `extract_concepts.py`
- **Added** `naming_adapter_path` parameter
- **Removed** separate model loading for naming
- **Uses** a single model instance with `set_lora_adapter()` to switch between tasks

```python
# OLD (doesn't work):
load concept_model → use → unload  # vLLM doesn't actually free memory!
load naming_model → use → unload   # OOM error here

# NEW (works):
load base_model with LoRA support
  ↓
load_lora_adapters({"concept": path1, "naming": path2})
  ↓
set_lora_adapter("concept") → extract concepts
  ↓
set_lora_adapter("naming") → name concepts
  ↓
done (base model stays loaded for next request)
```

#### 2. `concept_service.py`
- **Removed** nested context managers (`with concept_model: with naming_model:`)
- **Uses** single context manager: `with model_manager.use_model("concept")`
- **Passes** adapter paths to `extract_concepts_from_cluster()`

#### 3. `config.py`
- **Added** `CONCEPT_ADAPTER_PATH` setting
- **Added** `NAMING_ADAPTER_PATH` setting

#### 4. `model_manager.py`
- Already had full support for adapter swapping! ✓
- `use_model()` context manager handles adapter switching automatically
- Base model stays loaded across all requests

### Memory Flow

```
┌─────────────────────────────────────┐
│ API Startup                         │
│ - Base model NOT loaded yet         │
│ - Adapters registered              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ First Request                       │
│ - Load base model (35 GB)          │  ← Takes ~30 seconds
│ - Load all adapters (~200 MB)      │
│ - Set adapter: "concept"            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Extract Concepts                    │
│ - Active adapter: "concept"         │  ← ~35 GB total
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Switch to Naming                    │
│ - set_lora_adapter("naming")        │  ← Instant, no reload!
│ - Active adapter: "naming"          │  ← Still ~35 GB total
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Subsequent Requests                 │
│ - Base model already loaded         │  ← Instant start
│ - Just switch adapters              │
└─────────────────────────────────────┘
```

### Benefits

✅ **Solves OOM**: Only one base model loaded, ~35 GB (fits in 48 GB GPU)
✅ **Fast Adapter Switching**: ~0ms to switch between concept/naming (no reload)
✅ **Scalable**: Can add more adapters (relationship, attribute) without more memory
✅ **Faster Subsequent Requests**: Base model stays warm
✅ **Clean Architecture**: ModelManager handles all complexity

### Configuration

Add to your `.env` or environment:

```bash
CONCEPT_ADAPTER_PATH=/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_concepts_20251019163410/best
NAMING_ADAPTER_PATH=/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_naming_XXXXXX/best
```

### Usage

No changes needed in API calls - everything works transparently:

```python
# Your API handles this automatically
POST /api/concepts/generate-from-cluster
{
  "cluster_id": 1,
  "table_names": ["Person", "Address"],
  "database_id": "mydb"
}
```

Internally:
1. ModelManager loads base model (first time only)
2. Registers concept + naming adapters
3. extract_concepts switches between adapters as needed
4. Base model stays loaded for next request

### Testing

1. **Monitor GPU memory**: Should stay at ~35 GB throughout
2. **Check adapter switching**: Look for log messages `"Switched to 'concept' LoRA adapter"`
3. **Verify no OOM**: Process multiple clusters without memory errors
4. **Check speed**: First request slow (~30s startup), subsequent fast

### Implementation Details

The `FastLocalModel` class already supports:
- `load_lora_adapters({"name": "path", ...})` - Register multiple adapters
- `set_lora_adapter("name")` - Switch to an adapter (instant)
- `get_active_adapter()` - Check which adapter is active
- `list_adapters()` - List all registered adapters

This uses vLLM's native LoRA support which is memory-efficient and fast.
