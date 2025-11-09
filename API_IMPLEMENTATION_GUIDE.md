# API Implementation Guide

This document outlines all the API routes that need to be implemented for the Hamilton GUI backend to replace the mock endpoints with real functionality.

## Overview

The application uses a **job-based async pattern** for long-running operations. When a resource generation is requested (clustering, concepts, attributes), the API should:
1. Create a background job
2. Return a job ID immediately
3. Allow the frontend to poll the job status
4. Return the final result when complete

---

## Job Management System

### Core Job Endpoints

#### 1. Get Job Status
**Endpoint:** `GET /jobs/{job_id}`

**Purpose:** Poll the status of a background job

**Response Model:**
```json
{
  "jobId": "string",
  "type": "clustering" | "concepts" | "attributes",
  "status": "pending" | "running" | "completed" | "failed",
  "progress": {
    "current": 10,
    "total": 100,
    "message": "Processing cluster 3 of 10..."
  },
  "result": {
    // Job-specific result data (only when status is "completed")
  },
  "error": "string | null",
  "createdAt": "2025-11-07T10:30:00Z",
  "updatedAt": "2025-11-07T10:30:15Z"
}
```

**Implementation Notes:**
- Status should be updated as the background job progresses
- Progress object should be updated frequently to provide user feedback
- Result should only be populated when status is "completed"
- Error should contain a descriptive message if status is "failed"

---

## Database Management

### 1. List Databases
**Endpoint:** `GET /databases`

**Response:**
```json
[
  {
    "id": "db_000001",
    "name": "E-Commerce Database",
    "createdAt": "2025-11-07T10:00:00Z",
    "tableCount": 25,
    "status": "ready"
  }
]
```

### 2. Create Database from SQL File
**Endpoint:** `POST /databases`

**Request:** `multipart/form-data`
- `name`: string
- `sql_file`: File

**Response:**
```json
{
  "id": "db_000001",
  "name": "E-Commerce Database",
  "createdAt": "2025-11-07T10:00:00Z",
  "tableCount": 25,
  "status": "ready"
}
```

**Implementation:**
- Parse the SQL file to extract schema information
- Store table and column metadata
- Return database object with unique ID

### 3. Create Database from SQL Text
**Endpoint:** `POST /databases/from-text`

**Request:**
```json
{
  "name": "My Database",
  "sqlContent": "CREATE TABLE users (id INT PRIMARY KEY, ...);"
}
```

**Response:** Same as Create Database from SQL File

### 4. Get Database Details
**Endpoint:** `GET /databases/{database_id}`

**Response:**
```json
{
  "id": "db_000001",
  "name": "E-Commerce Database",
  "createdAt": "2025-11-07T10:00:00Z",
  "tableCount": 25,
  "status": "ready"
}
```

### 5. Get Database Schema
**Endpoint:** `GET /databases/{database_id}/schema`

**Response:**
```json
{
  "databaseId": "db_000001",
  "tableCount": 25,
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "dataType": "INT",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isNullable": false,
          "defaultValue": null,
          "referencedTable": null,
          "referencedColumn": null
        },
        {
          "name": "email",
          "dataType": "VARCHAR",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "defaultValue": null,
          "referencedTable": null,
          "referencedColumn": null
        }
      ]
    }
  ]
}
```

---

## Clustering

### 1. Start Clustering Job
**Endpoint:** `POST /databases/{database_id}/cluster`

**Request:**
```json
{
  "algorithm": "auto" | "hdbscan" | "kmeans",
  "parameters": {
    "minClusterSize": 2,
    "epsilon": 0.5
  }
}
```

**Response:**
```json
{
  "jobId": "job_cluster_1234567890",
  "message": "Clustering job started"
}
```

**Implementation:**
1. Create a background job with type "clustering"
2. Analyze table relationships (foreign keys, naming patterns, column similarities)
3. Apply clustering algorithm to group related tables
4. Update job progress periodically (e.g., "Analyzing table relationships...", "Applying clustering algorithm...", "Optimizing clusters...")
5. Store result when complete

**Job Result Format:**
```json
{
  "databaseId": "db_000001",
  "clusterCount": 5,
  "clusters": [
    {
      "clusterId": 1,
      "name": "User Management",
      "tables": ["users", "user_profiles", "user_addresses"],
      "description": "Tables related to user data and management"
    },
    {
      "clusterId": 2,
      "name": "Order Processing",
      "tables": ["orders", "order_items", "order_status"],
      "description": "Tables related to order management"
    }
  ]
}
```

---

## Concept Generation

### 1. Generate Concepts for Cluster
**Endpoint:** `POST /databases/{database_id}/clusters/{cluster_id}/concepts`

**Response:**
```json
{
  "jobId": "job_concept_1234567890",
  "message": "Concept generation started"
}
```

**Implementation:**
1. Create a background job with type "concepts"
2. Analyze the cluster's tables and their relationships
3. Identify potential business concepts based on:
   - Table names and purposes
   - Primary and foreign key relationships
   - Column patterns
   - Data semantics
4. Generate ID attributes (how to identify this concept)
5. Generate conditions (filtering rules)
6. Generate joins (how to combine tables)
7. Update progress: "Analyzing cluster structure...", "Identifying concepts...", "Generating attributes..."

**Job Result Format:**
```json
{
  "clusterId": 1,
  "concepts": [
    {
      "id": "concept_1_users",
      "name": "User",
      "description": "Represents a user in the system",
      "idAttributes": [
        {
          "name": "User ID",
          "attributes": [
            {
              "table": "users",
              "column": "id"
            }
          ]
        }
      ],
      "conditions": [
        "users.is_active = 1",
        "users.deleted_at IS NULL"
      ],
      "joins": [
        "FROM users",
        "LEFT JOIN user_profiles ON users.id = user_profiles.user_id"
      ]
    }
  ]
}
```

### 2. Save Confirmed Concepts
**Endpoint:** `POST /databases/{database_id}/clusters/{cluster_id}/concepts/save`

**Request:**
```json
{
  "clusterId": 1,
  "concepts": [
    // Array of concept objects (same structure as above)
  ]
}
```

**Response:**
```json
{
  "message": "Concepts saved successfully",
  "conceptCount": 5
}
```

**Implementation:**
- Store the confirmed concepts for later use in attribute and relationship generation
- Link concepts to their database and cluster

### 3. Get All Concepts for Database
**Endpoint:** `GET /databases/{database_id}/concepts`

**Response:**
```json
{
  "concepts": [
    // Array of all confirmed concepts for this database
  ]
}
```

---

## Attribute Generation

### 1. Generate Attributes for Concept
**Endpoint:** `POST /databases/{database_id}/concepts/{concept_id}/attributes`

**Response:**
```json
{
  "jobId": "job_attr_1234567890",
  "message": "Attribute generation started"
}
```

**Implementation:**
1. Create a background job with type "attributes"
2. Analyze the concept's structure:
   - Tables involved (from ID attributes and joins)
   - Available columns in those tables
   - Column data types and semantics
3. Generate attribute suggestions:
   - Map database columns to meaningful business attributes
   - Determine data types
   - Identify required vs optional attributes
   - Handle static values vs database references
4. Update progress: "Analyzing concept structure...", "Identifying available columns...", "Generating attribute suggestions..."

**Job Result Format:**
```json
{
  "attributes": [
    {
      "id": "attr_user_1",
      "name": "Full Name",
      "column": "full_name",
      "table": "users",
      "dataType": "VARCHAR",
      "isRequired": true,
      "staticValue": null,
      "joins": []
    },
    {
      "id": "attr_user_2",
      "name": "Email Address",
      "column": "email",
      "table": "users",
      "dataType": "VARCHAR",
      "isRequired": true,
      "staticValue": null,
      "joins": []
    },
    {
      "id": "attr_user_3",
      "name": "Profile Picture URL",
      "column": "avatar_url",
      "table": "user_profiles",
      "dataType": "VARCHAR",
      "isRequired": false,
      "staticValue": null,
      "joins": [
        "LEFT JOIN user_profiles ON users.id = user_profiles.user_id"
      ]
    }
  ]
}
```

### 2. Save Confirmed Attributes
**Endpoint:** `POST /databases/{database_id}/concepts/{concept_id}/attributes/save`

**Request:**
```json
{
  "attributes": [
    // Array of attribute objects
  ]
}
```

**Response:**
```json
{
  "message": "Attributes saved successfully",
  "conceptId": "concept_1_users",
  "attributeCount": 8
}
```

---

## Relationship Generation

### 1. Suggest Relationships
**Endpoint:** `GET /databases/{database_id}/relationships/suggest`

**Response:**
```json
[
  {
    "id": "rel_1",
    "fromConceptId": "concept_1_users",
    "toConceptId": "concept_10_orders",
    "name": "places",
    "confidence": 0.95
  },
  {
    "id": "rel_2",
    "fromConceptId": "concept_10_orders",
    "toConceptId": "concept_4_products",
    "name": "contains",
    "confidence": 0.88
  }
]
```

**Implementation:**
1. Analyze all confirmed concepts in the database
2. Identify potential relationships based on:
   - Foreign key relationships between tables
   - Table naming patterns (e.g., "user_orders" suggests User → Order)
   - Join conditions in concepts
   - Column name similarities
3. Calculate confidence scores based on:
   - Direct foreign key = high confidence (0.9-1.0)
   - Naming pattern match = good confidence (0.75-0.89)
   - Inferred from schema = medium confidence (0.6-0.74)
   - Weak signals = low confidence (<0.6)
4. Return relationships sorted by confidence (highest first)

**Confidence Color Mapping (Frontend):**
- Green: ≥90% - High confidence
- Blue: 75-89% - Good confidence
- Amber: 60-74% - Medium confidence
- Red: <60% - Low confidence

### 2. Confirm Relationships
**Endpoint:** `POST /databases/{database_id}/relationships/confirm`

**Request:**
```json
{
  "relationships": [
    {
      "id": "rel_1",
      "fromConceptId": "concept_1_users",
      "toConceptId": "concept_10_orders",
      "name": "places",
      "confidence": 0.95
    }
  ]
}
```

**Response:**
```json
{
  "message": "Confirmed 5 relationship(s)",
  "databaseId": "db_000001",
  "relationshipCount": 5
}
```

---

## Backend Implementation Requirements

### 1. Job Manager Setup

You need a job management system that can:

**Create Jobs:**
```python
from app.core.job_manager import job_manager

# Create a new job
job = job_manager.create_job(
    job_type=JobType.CLUSTERING,  # or CONCEPTS, ATTRIBUTES
    database_id=database_id,
    parameters={"cluster_id": cluster_id}  # optional parameters
)

# Return job ID to frontend
return JobCreateResponse(jobId=job.id, message="Job started")
```

**Update Progress:**
```python
# In your background task
job_manager.update_progress(
    job_id=job.id,
    current=5,
    total=10,
    message="Processing cluster 5 of 10..."
)
```

**Complete Job:**
```python
# When processing is done
result = {
    "clusters": [...],
    "clusterCount": 5
}
job_manager.complete_job(job.id, result)
```

**Fail Job:**
```python
# If an error occurs
job_manager.fail_job(job.id, error_message="Database connection failed")
```

### 2. Background Task Execution

Use FastAPI's background tasks or Celery:

**Option A: FastAPI Background Tasks (Simple)**
```python
import asyncio
from fastapi import BackgroundTasks

@router.post("/databases/{database_id}/cluster")
async def start_clustering(
    database_id: str,
    background_tasks: BackgroundTasks
):
    job = job_manager.create_job(
        job_type=JobType.CLUSTERING,
        database_id=database_id
    )
    
    # Add background task
    background_tasks.add_task(perform_clustering, job.id, database_id)
    
    return JobCreateResponse(jobId=job.id)

async def perform_clustering(job_id: str, database_id: str):
    try:
        # Your clustering logic here
        job_manager.update_progress(job_id, 1, 5, "Analyzing tables...")
        # ... do work ...
        job_manager.update_progress(job_id, 3, 5, "Clustering tables...")
        # ... more work ...
        result = {"clusters": [...]}
        job_manager.complete_job(job_id, result)
    except Exception as e:
        job_manager.fail_job(job_id, str(e))
```

**Option B: Celery (Production)**
```python
from celery import Celery

celery_app = Celery('tasks', broker='redis://localhost:6379')

@celery_app.task
def perform_clustering_task(job_id: str, database_id: str):
    try:
        job_manager.update_progress(job_id, 1, 5, "Starting...")
        # Your clustering logic
        result = {"clusters": [...]}
        job_manager.complete_job(job_id, result)
    except Exception as e:
        job_manager.fail_job(job_id, str(e))

@router.post("/databases/{database_id}/cluster")
async def start_clustering(database_id: str):
    job = job_manager.create_job(JobType.CLUSTERING, database_id)
    perform_clustering_task.delay(job.id, database_id)
    return JobCreateResponse(jobId=job.id)
```

### 3. Job Storage

Jobs should be stored in a way that persists across requests:

**In-Memory (Development):**
```python
# Simple dict storage
JOBS = {}

class JobManager:
    def create_job(self, job_type, database_id, parameters=None):
        job_id = f"job_{job_type}_{int(time.time())}"
        job = Job(
            id=job_id,
            type=job_type,
            status=JobStatus.PENDING,
            database_id=database_id
        )
        JOBS[job_id] = job
        return job
    
    def get_job(self, job_id):
        return JOBS.get(job_id)
```

**Database (Production):**
```python
# Store in PostgreSQL/MySQL
class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(String, primary_key=True)
    type = Column(String)
    status = Column(String)
    progress_current = Column(Integer)
    progress_total = Column(Integer)
    progress_message = Column(String)
    result_json = Column(JSON)
    error = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

### 4. Frontend Polling

The frontend uses `useJobPolling` hook which:
1. Calls `GET /jobs/{job_id}` every 1-2 seconds
2. Checks if status is "completed" or "failed"
3. Calls `onComplete(result)` when done
4. Calls `onError(error)` if failed
5. Updates UI with progress

You don't need to implement anything special on the backend - just make sure the job status endpoint returns up-to-date information.

---

## Testing the Implementation

### 1. Test Job Flow
```bash
# Create a clustering job
curl -X POST http://localhost:8000/databases/db_000001/cluster \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "auto"}'

# Response: {"jobId": "job_cluster_1234567890"}

# Poll job status
curl http://localhost:8000/jobs/job_cluster_1234567890

# Should return progress updates, then final result
```

### 2. Use Mock Routes as Reference

The mock routes in `/backend/app/api/routes/mock.py` provide working examples of:
- Job creation and management
- Response formats
- Progress updates
- Result structures

You can copy the response structures and adapt the logic to use real algorithms instead of mock data.

---

## Priority Order for Implementation

1. **Job Management System** - Required for all async operations
2. **Database Schema Parsing** - GET `/databases/{id}/schema`
3. **Clustering** - POST `/databases/{id}/cluster` + job processing
4. **Concept Generation** - POST `/databases/{id}/clusters/{id}/concepts` + job processing
5. **Attribute Generation** - POST `/databases/{id}/concepts/{id}/attributes` + job processing
6. **Relationship Suggestions** - GET `/databases/{id}/relationships/suggest`

Each step builds on the previous, so implement in order.

---

## Additional Notes

- All dates should be in ISO 8601 format
- Use proper HTTP status codes (200, 201, 202, 400, 404, 500)
- Include error messages in response body
- The frontend expects snake_case in some fields and camelCase in others (check mock.py)
- Progress updates should be frequent (every 1-2 seconds of work)
- Keep job results in storage for at least 1 hour after completion
