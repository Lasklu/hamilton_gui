# Incremental Concept Generation Architecture

## Overview

The system processes clusters sequentially to generate concepts, with results displayed incrementally as each cluster completes. Each cluster's concepts are generated with full context of previously generated concepts for consistency.

## Backend Architecture

### 1. ConceptService (`backend/app/services/concept_service.py`)

**Your Implementation Point:**

```python
async def process_cluster(
    self,
    cluster_id: int,
    table_names: List[str],
    database_id: str,
    existing_concepts: Optional[List[Concept]] = None,
    progress_callback=None
) -> ConceptSuggestion:
```

**What you need to implement:**
- Call your AI model with the cluster's tables
- Use `existing_concepts` as context for consistency across clusters
- Use `progress_callback(current, total, message)` to report progress
- Return `ConceptSuggestion` with generated concepts

**Example implementation structure:**

```python
async def process_cluster(self, cluster_id, table_names, database_id, existing_concepts, progress_callback):
    # Step 1: Get database schema for these tables
    if progress_callback:
        progress_callback(10, 100, "Loading schema...")
    
    schema = await get_schema_for_tables(database_id, table_names)
    
    # Step 2: Prepare context from existing concepts
    if progress_callback:
        progress_callback(30, 100, "Preparing context...")
    
    context = prepare_context(existing_concepts) if existing_concepts else None
    
    # Step 3: Call AI model
    if progress_callback:
        progress_callback(50, 100, "Generating concepts with AI...")
    
    ai_response = await your_ai_model.generate_concepts(
        schema=schema,
        context=context,
        cluster_id=cluster_id
    )
    
    # Step 4: Convert to Concept objects
    if progress_callback:
        progress_callback(90, 100, "Processing results...")
    
    concepts = [
        Concept(
            id=f"concept_{cluster_id}_{i}",
            name=concept_data["name"],
            clusterId=cluster_id,
            idAttributes=[...],
            attributes=[...],
            confidence=concept_data.get("confidence", 0.8)
        )
        for i, concept_data in enumerate(ai_response)
    ]
    
    if progress_callback:
        progress_callback(100, 100, f"Generated {len(concepts)} concepts")
    
    return ConceptSuggestion(concepts=concepts)
```

### 2. API Endpoints (`backend/app/api/routes/concepts.py`)

#### POST `/databases/{database_id}/concepts/generate`
**Async endpoint for processing all clusters**

- Accepts: List of `ClusterInfo` objects
- Returns: `JobCreateResponse` with `jobId`
- Behavior:
  - Processes clusters sequentially
  - Each cluster gets context from previous clusters
  - Updates job result incrementally after each cluster
  - Frontend can poll `/jobs/{jobId}` to get partial results

#### POST `/databases/{database_id}/concepts/cluster/{cluster_id}`
**Sync endpoint for single cluster** (optional, for manual processing)

- Accepts: `table_names` and optional `existing_concepts`
- Returns: `ConceptSuggestion` immediately
- Use case: Manual/individual cluster processing

### 3. Job Progress Updates

**The job result structure during processing:**

```json
{
  "databaseId": "db_123",
  "concepts": [...],  // All concepts generated so far
  "processedClusters": 2,  // How many clusters completed
  "totalClusters": 5,      // Total clusters to process
  "isComplete": false      // Whether all done
}
```

**Progress messages:**
```
[Cluster 1/5] Starting cluster 'User Data'...
[Cluster 1/5] Loading schema...
[Cluster 1/5] Generating concepts with AI...
[Cluster 1/5] Completed cluster 'User Data' (3 concepts)
[Cluster 2/5] Starting cluster 'Products'...
...
```

## Frontend Integration

### 1. Starting Concept Generation

```typescript
// In your ConceptEditingStep component
const handleStartConceptGeneration = async () => {
  try {
    // Start the job
    const { jobId } = await client.concepts.generateConceptsForAllClusters(
      databaseId,
      clusters // from clustering step
    )
    
    setJobId(jobId)
    setIsGenerating(true)
  } catch (error) {
    toast.error('Failed to start concept generation')
  }
}
```

### 2. Polling for Incremental Results

```typescript
// Use the existing useJobPolling hook
const { status, progress, result, error } = useJobPolling(
  (id) => client.jobs.getStatus(id),
  {
    jobId,
    enabled: !!jobId && isGenerating,
    pollingInterval: 2000, // Poll every 2 seconds
    onComplete: (finalResult) => {
      setConcepts(finalResult.concepts)
      setIsGenerating(false)
      toast.success('All concepts generated!')
    },
    onError: (err) => {
      setError(err)
      setIsGenerating(false)
    }
  }
)

// Display partial results as they arrive
useEffect(() => {
  if (result && result.concepts) {
    // Update UI with partial concepts
    setConcepts(result.concepts)
    setProcessedClusters(result.processedClusters)
    setTotalClusters(result.totalClusters)
  }
}, [result])
```

### 3. UI Display Pattern

```tsx
<div>
  {/* Progress indicator */}
  {isGenerating && progress && (
    <div>
      <ProgressBar value={progress.percentage} />
      <p>{progress.message}</p>
      <p>
        Processed {result?.processedClusters || 0} of {result?.totalClusters || 0} clusters
      </p>
    </div>
  )}
  
  {/* Incremental concept display */}
  <div>
    <h3>Generated Concepts ({concepts.length})</h3>
    {concepts.map((concept, index) => (
      <ConceptCard
        key={concept.id}
        concept={concept}
        // Highlight newly added concepts
        isNew={index >= previousConceptCount}
      />
    ))}
  </div>
  
  {/* Show which cluster is being processed */}
  {isGenerating && result && (
    <div>
      <h4>Currently Processing:</h4>
      <p>Cluster {result.processedClusters + 1} of {result.totalClusters}</p>
    </div>
  )}
</div>
```

## Workflow Summary

1. **User completes clustering** → has list of `ClusterInfo` objects
2. **User clicks "Generate Concepts"** → frontend calls `/databases/{id}/concepts/generate`
3. **Backend creates job** → starts processing clusters sequentially
4. **For each cluster:**
   - Backend calls `ConceptService.process_cluster()`
   - Your AI model runs with context from previous clusters
   - Progress callbacks update job status
   - Results added to job.result incrementally
5. **Frontend polls job status** → receives partial results every 2s
6. **UI updates incrementally** → shows concepts as they're generated
7. **All clusters complete** → job status becomes "completed"
8. **Frontend receives final result** → all concepts available

## Key Benefits

✅ **Smooth UX**: Users see results as they're generated, not all at once
✅ **Context awareness**: Each cluster sees concepts from previous clusters
✅ **Progress visibility**: Clear progress messages per cluster
✅ **Resumable**: If something fails, you know which cluster failed
✅ **Testable**: Can test single clusters independently
✅ **Scalable**: Works for 1 cluster or 100 clusters

## Next Steps for You

1. Implement `ConceptService.process_cluster()` with your AI model
2. Add any database schema fetching logic you need
3. Test with a single cluster first using the sync endpoint
4. Then test the full multi-cluster workflow
5. Add any custom progress messages specific to your AI model

## Example Test Flow

```bash
# 1. Generate concepts for all clusters
curl -X POST http://localhost:8000/databases/db_123/concepts/generate \
  -H "Content-Type: application/json" \
  -d '[{"clusterId":0,"name":"Cluster 1","tables":["users","profiles"]}, ...]'

# Response: {"jobId": "job_abc123"}

# 2. Poll job status (repeat every 2s)
curl http://localhost:8000/jobs/job_abc123

# Response (partial):
{
  "status": "running",
  "progress": {"percentage": 40, "message": "[Cluster 2/5] Generating..."},
  "result": {
    "concepts": [...],  // Concepts from clusters 1-2
    "processedClusters": 2,
    "totalClusters": 5,
    "isComplete": false
  }
}

# Response (complete):
{
  "status": "completed",
  "progress": {"percentage": 100, "message": "Completed"},
  "result": {
    "concepts": [...],  // All concepts
    "processedClusters": 5,
    "totalClusters": 5,
    "isComplete": true
  }
}
```
