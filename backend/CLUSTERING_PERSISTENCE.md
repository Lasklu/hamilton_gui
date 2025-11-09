# Clustering Persistence Implementation

This document describes the complete implementation of clustering persistence to the metadata database.

## Overview

Clustering results can now be saved to the metadata database, listed, loaded, and set as active. This allows users to:
- Save clustering results with user-friendly names
- Compare different clustering approaches
- Resume work from previously saved clusterings
- Cancel running clustering jobs when loading existing results

## Database Model

**File**: `/backend/app/db/models.py`

The `ClusteringResult` model has been enhanced with:

```python
class ClusteringResult(Base):
    __tablename__ = "clustering_results"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    database_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)  # NEW: User-friendly name
    algorithm: Mapped[str] = mapped_column(String, default="schuyler")
    applied_finetuning: Mapped[bool] = mapped_column(Boolean, default=False)  # NEW
    parameters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cluster_count: Mapped[int] = mapped_column(Integer)
    clusters: Mapped[str] = mapped_column(Text)  # JSON array
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # NEW
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

**Key Fields**:
- `name`: User-friendly name for the clustering (e.g., "Initial clustering", "After manual adjustments")
- `applied_finetuning`: Flag indicating if finetuning was applied during generation
- `is_active`: Only one clustering can be active per database at a time
- `clusters`: JSON-serialized array of ClusterInfo objects

## Service Layer

**File**: `/backend/app/services/clustering_service.py`

Added persistence methods to `ClusteringService`:

### `save_clustering()`
```python
async def save_clustering(
    db: Session,
    database_id: str,
    clustering_result: ClusteringResult,
    name: str,
    applied_finetuning: bool = False,
    set_active: bool = True
) -> int
```

Saves a clustering result to the database. If `set_active=True`, deactivates all other clusterings for this database.

**Returns**: ID of the saved clustering

### `get_clustering()`
```python
async def get_clustering(
    db: Session,
    clustering_id: int
) -> ClusteringResult
```

Loads a saved clustering and converts it back to a `ClusteringResult` object.

**Raises**: `NotFoundError` if clustering doesn't exist

### `list_clusterings()`
```python
async def list_clusterings(
    db: Session,
    database_id: str
) -> List[dict]
```

Returns a list of all saved clusterings for a database, ordered by creation date (newest first).

**Returns**: List of summaries with `id`, `name`, `clusterCount`, `appliedFinetuning`, `isActive`, `createdAt`

### `get_active_clustering()`
```python
async def get_active_clustering(
    db: Session,
    database_id: str
) -> Optional[ClusteringResult]
```

Gets the currently active clustering for a database.

**Returns**: `ClusteringResult` or `None` if no active clustering exists

### `set_active_clustering()`
```python
async def set_active_clustering(
    db: Session,
    clustering_id: int
) -> None
```

Sets a clustering as active and deactivates all others for its database.

## API Endpoints

**File**: `/backend/app/api/routes/clustering.py`

### Save Clustering
```
PUT /databases/{database_id}/cluster
Body: { name: string, clustering: ClusteringResult }
```

Saves a clustering result with a user-friendly name. Sets it as the active clustering.

**Response**: `{ success: boolean, message: string, clusteringId: number }`

### List Saved Clusterings
```
GET /databases/{database_id}/cluster/saved
```

Retrieves all saved clusterings for a database.

**Response**: Array of `ClusteringSummary` objects

### Get Saved Clustering
```
GET /databases/{database_id}/cluster/saved/{clustering_id}
```

Loads a specific saved clustering.

**Response**: `ClusteringResult` object

### Get Active Clustering
```
GET /databases/{database_id}/cluster/active
```

Gets the currently active clustering for a database.

**Response**: `ClusteringResult` or `null`

### Activate Clustering
```
PUT /databases/{database_id}/cluster/saved/{clustering_id}/activate
```

Sets a clustering as the active one.

**Response**: `{ success: boolean, message: string }`

## Frontend API Client

**File**: `/frontend/src/lib/api/services/clustering.ts`

Added TypeScript methods:

```typescript
export interface ClusteringSummary {
  id: number
  name: string
  clusterCount: number
  appliedFinetuning: boolean
  isActive: boolean
  createdAt: string
}

clusteringApi.saveClustering(databaseId, clustering, name)
clusteringApi.listSavedClusterings(databaseId)
clusteringApi.getSavedClustering(databaseId, clusteringId)
clusteringApi.getActiveClustering(databaseId)
clusteringApi.activateClustering(databaseId, clusteringId)
```

## Usage Flow

### Saving a Clustering

1. User generates clustering via `POST /databases/{id}/cluster` (returns job ID)
2. Job completes with `ClusteringResult` in job.result
3. User optionally modifies clusters (drag & drop tables)
4. User clicks "Save Clustering" button
5. Frontend prompts for a name
6. Frontend calls `clusteringApi.saveClustering(databaseId, result, name)`
7. Backend saves to database and marks as active

### Loading a Saved Clustering

1. Frontend calls `clusteringApi.listSavedClusterings(databaseId)`
2. Display list in dropdown: "Initial clustering (2024-01-15 10:30)"
3. User selects a clustering from dropdown
4. Frontend calls `clusteringApi.getSavedClustering(databaseId, clusteringId)`
5. Replace current clustering state with loaded result
6. **Important**: Cancel any running clustering job (see next section)

### Cancelling Running Jobs

When loading an existing clustering, check if there's an active clustering job:

```typescript
// Check if there's a running job
if (currentJobId && jobStatus?.status === 'running') {
  // Cancel the job (you may need to add a cancel endpoint)
  // Or just stop polling and clear the job state
  setCurrentJobId(null)
  stopPolling()
}

// Load the saved clustering
const clustering = await clusteringApi.getSavedClustering(databaseId, clusteringId)
setClusteringResult(clustering)
```

## Next Steps (Frontend)

### 1. Add Clustering Dropdown Component

Create a dropdown in `DatabaseClusteringStep.tsx`:

```typescript
const [savedClusterings, setSavedClusterings] = useState<ClusteringSummary[]>([])

useEffect(() => {
  if (databaseId) {
    clusteringApi.listSavedClusterings(databaseId)
      .then(setSavedClusterings)
      .catch(console.error)
  }
}, [databaseId])

// In render:
<Select 
  value={activeClusteringId}
  onValueChange={async (clusteringId) => {
    // Cancel running job if any
    if (currentJobId) {
      // Stop polling
    }
    
    // Load clustering
    const result = await clusteringApi.getSavedClustering(databaseId, clusteringId)
    setClusteringResult(result)
  }}
>
  {savedClusterings.map(c => (
    <SelectItem key={c.id} value={c.id.toString()}>
      {c.name} ({c.clusterCount} clusters) - {formatDate(c.createdAt)}
      {c.isActive && " [Active]"}
    </SelectItem>
  ))}
</Select>
```

### 2. Add Save Button

During the modification phase, add a "Save Clustering" button:

```typescript
<Button onClick={handleSave}>Save Clustering</Button>

const handleSave = async () => {
  const name = prompt("Enter a name for this clustering:")
  if (!name) return
  
  try {
    await clusteringApi.saveClustering(databaseId, clusteringResult, name)
    toast.success("Clustering saved successfully!")
    // Refresh the dropdown list
    refreshSavedClusterings()
  } catch (error) {
    toast.error("Failed to save clustering")
  }
}
```

### 3. Auto-load Active Clustering

When entering the clustering step, automatically load the active clustering if it exists:

```typescript
useEffect(() => {
  if (databaseId) {
    clusteringApi.getActiveClustering(databaseId)
      .then(result => {
        if (result) {
          setClusteringResult(result)
        }
      })
  }
}, [databaseId])
```

## Database Migration

If you haven't already, run a migration to add the new fields to the `clustering_results` table:

```python
# Migration file (alembic or similar)
def upgrade():
    op.add_column('clustering_results', sa.Column('name', sa.String(), nullable=True))
    op.add_column('clustering_results', sa.Column('applied_finetuning', sa.Boolean(), default=False))
    op.add_column('clustering_results', sa.Column('is_active', sa.Boolean(), default=True))
```

Or simply drop and recreate the table (if you're in development and don't have important data):

```bash
rm hamilton_metadata.db
# Database will be recreated on next startup
```

## Testing

Test the full workflow:

1. Start a clustering job: `POST /databases/{id}/cluster`
2. Wait for completion
3. Save it: `PUT /databases/{id}/cluster` with name "First attempt"
4. Modify clusters (drag tables around)
5. Save again: `PUT /databases/{id}/cluster` with name "After adjustments"
6. List clusterings: `GET /databases/{id}/cluster/saved`
   - Should show both clusterings
   - "After adjustments" should be active
7. Load first one: `GET /databases/{id}/cluster/saved/{id}`
   - Should return original clustering
8. Activate first one: `PUT /databases/{id}/cluster/saved/{id}/activate`
9. Check active: `GET /databases/{id}/cluster/active`
   - Should return "First attempt"

## Implementation Status

✅ **Completed**:
- Database model enhancement (name, is_active, applied_finetuning)
- Service layer CRUD methods (save, get, list, get_active, set_active)
- API endpoints (5 new routes)
- Frontend API client methods (ClusteringSummary interface + 5 methods)

❌ **Pending**:
- Frontend dropdown UI component
- Save button with name prompt dialog
- Job cancellation logic when loading existing clustering
- Auto-load active clustering on step entry
- Database migration (if needed)
