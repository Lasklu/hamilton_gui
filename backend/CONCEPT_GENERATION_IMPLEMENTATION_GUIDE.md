# Concept Generation Implementation Guide

This guide explains how to implement the concept generation functionality for your database clustering system.

## Overview

The concept generation system processes clusters sequentially, generating semantic concepts from database tables. Each cluster's concepts are generated with context from previously processed clusters for consistency.

## Architecture

### 1. API Flow

```
POST /databases/{id}/concepts/generate
  ↓
Creates background job
  ↓
For each cluster sequentially:
  ↓
  calls concept_service.process_cluster()
  ↓
  Updates job with partial results
  ↓
Frontend polls job status and displays concepts incrementally
```

### 2. Your Implementation Point

You need to implement the `process_cluster()` method in `/backend/app/services/concept_service.py`.

This method receives:
- **cluster_id**: The cluster being processed
- **table_names**: List of tables in this cluster (e.g., `["Person", "Address", "Contact"]`)
- **database_id**: The database identifier to fetch schema information
- **existing_concepts**: Concepts already generated from previous clusters (for context)
- **progress_callback**: Function to report progress to the frontend

Your method should return a `ConceptSuggestion` containing a list of `Concept` objects.

## Data Models

### ConceptAttribute
```python
{
    "table": "Person",
    "column": "pid"
}
```

### ConceptIDAttribute
```python
{
    "attributes": [
        {"table": "Person", "column": "pid"}
    ]
}
```

### ConceptCondition
```python
{
    "table": "Person",
    "column": "type",
    "operator": "EQUALS",
    "value": "tester"
}
```

### Concept (Full Example)
```python
{
    "id": "concept_person_1",  # Optional
    "name": "Person",  # Optional
    "clusterId": 1,  # Optional
    "idAttributes": [
        {
            "attributes": [
                {"table": "Person", "column": "pid"}
            ]
        }
    ],
    "attributes": [  # Optional
        {"table": "Person", "column": "name"},
        {"table": "Person", "column": "email"}
    ],
    "confidence": 0.95,  # Optional
    "conditions": [  # Optional
        {
            "table": "Person",
            "column": "type",
            "operator": "EQUALS",
            "value": "active"
        }
    ],
    "subConcepts": [  # Optional - recursive
        {
            "idAttributes": [
                {"attributes": [{"table": "Person", "column": "pid"}]}
            ],
            "conditions": [
                {
                    "table": "Person",
                    "column": "type",
                    "operator": "EQUALS",
                    "value": "tester"
                }
            ]
        }
    ],
    "joins": []  # Optional
}
```

## Implementation Template

Here's a complete template for `concept_service.py`:

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
from app.services.database_service import DatabaseService
from typing import List, Optional

logger = get_logger(__name__)


class ConceptService:
    """Service for generating and managing concepts from database clusters."""

    def __init__(self):
        """Initialize the concept service."""
        self.database_service = DatabaseService()

    async def process_cluster(
        self,
        cluster_id: int,
        table_names: List[str],
        database_id: str,
        existing_concepts: Optional[List[Concept]] = None,
        progress_callback=None
    ) -> ConceptSuggestion:
        """
        Process a single cluster to generate concepts.
        
        Args:
            cluster_id: ID of the cluster being processed
            table_names: List of table names in this cluster
            database_id: Database identifier
            existing_concepts: Previously generated concepts (for context)
            progress_callback: Optional callback(current, total, message)
            
        Returns:
            ConceptSuggestion containing generated concepts
        """
        logger.info(
            f"Processing cluster {cluster_id} with {len(table_names)} tables "
            f"(existing concepts: {len(existing_concepts) if existing_concepts else 0})"
        )
        
        # Step 1: Report initial progress
        if progress_callback:
            progress_callback(0, 100, f"Analyzing {len(table_names)} tables...")
        
        # Step 2: Get database schema for these tables
        try:
            database = await self.database_service.get_database(database_id)
            schema = await self.database_service.get_schema(database_id)
            
            # Filter schema to only tables in this cluster
            cluster_tables = [
                table for table in schema.tables 
                if table.name in table_names
            ]
            
            logger.info(f"Loaded schema for {len(cluster_tables)} tables")
            
        except Exception as e:
            logger.error(f"Failed to load schema: {e}")
            raise
        
        # Step 3: Report progress
        if progress_callback:
            progress_callback(20, 100, "Schema loaded, analyzing relationships...")
        
        # Step 4: Call your AI model / concept generation logic
        concepts = await self._generate_concepts_from_tables(
            cluster_id=cluster_id,
            tables=cluster_tables,
            existing_concepts=existing_concepts,
            progress_callback=progress_callback
        )
        
        # Step 5: Final progress
        if progress_callback:
            progress_callback(100, 100, f"Generated {len(concepts)} concepts")
        
        logger.info(f"Cluster {cluster_id} processing complete: {len(concepts)} concepts")
        
        return ConceptSuggestion(concepts=concepts)

    async def _generate_concepts_from_tables(
        self,
        cluster_id: int,
        tables: List[any],  # List of TableMetadata objects
        existing_concepts: Optional[List[Concept]],
        progress_callback=None
    ) -> List[Concept]:
        """
        YOUR IMPLEMENTATION GOES HERE.
        
        This is where you call your AI model or implement your concept
        generation logic.
        
        Args:
            cluster_id: The cluster being processed
            tables: List of table metadata objects with schema info
            existing_concepts: Concepts from previous clusters
            progress_callback: Progress reporting function
            
        Returns:
            List of Concept objects
        """
        
        # Step 1: Prepare data for your AI model
        # Extract table information
        table_info = []
        for table in tables:
            table_data = {
                "name": table.name,
                "columns": [
                    {
                        "name": col.name,
                        "type": col.type,
                        "primary_key": col.primary_key,
                        "foreign_key": col.foreign_key
                    }
                    for col in table.columns
                ]
            }
            table_info.append(table_data)
        
        if progress_callback:
            progress_callback(30, 100, "Prepared table information...")
        
        # Step 2: Format existing concepts for context (if any)
        context = None
        if existing_concepts:
            context = {
                "previous_concepts": [
                    {
                        "name": c.name,
                        "id_attributes": c.id_attributes,
                        "tables": list(set(
                            attr.table 
                            for id_attr in c.id_attributes 
                            for attr in id_attr.attributes
                        ))
                    }
                    for c in existing_concepts
                ]
            }
        
        if progress_callback:
            progress_callback(40, 100, "Calling AI model...")
        
        # Step 3: Call your AI model
        # TODO: Replace this with your actual AI model call
        # Example:
        # ai_response = await your_ai_model.generate_concepts(
        #     tables=table_info,
        #     context=context
        # )
        
        # For now, create example concepts based on your JSON structure
        concepts = self._create_example_concepts(cluster_id, tables)
        
        if progress_callback:
            progress_callback(90, 100, f"Processing {len(concepts)} concepts...")
        
        return concepts

    def _create_example_concepts(
        self, 
        cluster_id: int, 
        tables: List[any]
    ) -> List[Concept]:
        """
        Example concept creation based on your JSON structure.
        REPLACE THIS with your actual AI model response parsing.
        """
        concepts = []
        
        # Example: Create a concept for each table with sub-concepts
        for table in tables:
            # Find primary key columns
            pk_columns = [col for col in table.columns if col.primary_key]
            
            if not pk_columns:
                # Skip tables without primary keys or use first column
                pk_columns = [table.columns[0]] if table.columns else []
            
            # Create ID attributes
            id_attributes = [
                ConceptIDAttribute(
                    attributes=[
                        ConceptAttribute(
                            table=table.name,
                            column=col.name
                        )
                        for col in pk_columns
                    ]
                )
            ]
            
            # Check for type/category columns for sub-concepts
            type_columns = [
                col for col in table.columns 
                if 'type' in col.name.lower() or 'category' in col.name.lower()
            ]
            
            sub_concepts = None
            if type_columns:
                # Create sub-concepts for different types
                # This matches your example with Person -> tester, reviewer, student, author
                type_col = type_columns[0]
                sub_concepts = [
                    Concept(
                        id_attributes=id_attributes,
                        conditions=[
                            ConceptCondition(
                                table=table.name,
                                column=type_col.name,
                                operator="EQUALS",
                                value=f"type_{i}"  # Replace with actual values from data
                            )
                        ]
                    )
                    for i in range(1, 5)  # Example: 4 sub-types
                ]
            
            # Create main concept
            concept = Concept(
                id=f"concept_{cluster_id}_{table.name}",
                name=table.name,
                cluster_id=cluster_id,
                id_attributes=id_attributes,
                attributes=[
                    ConceptAttribute(table=table.name, column=col.name)
                    for col in table.columns
                    if not col.primary_key
                ][:5],  # Limit to first 5 non-PK columns
                confidence=0.85,
                sub_concepts=sub_concepts
            )
            
            concepts.append(concept)
        
        return concepts
```

## Integration Steps

### 1. Update concept_service.py

Replace the current `concept_service.py` with the template above, then implement your AI model logic in `_generate_concepts_from_tables()`.

### 2. Get Database Schema

The template shows how to fetch schema information:

```python
database = await self.database_service.get_database(database_id)
schema = await self.database_service.get_schema(database_id)
```

Each table in `schema.tables` has:
- `name`: Table name
- `columns`: List of columns
  - `name`: Column name
  - `type`: Data type
  - `primary_key`: Boolean
  - `foreign_key`: Foreign key reference (if any)

### 3. Call Your AI Model

Your AI model should receive:
- **Table schemas**: Column names, types, keys, relationships
- **Existing concepts**: For context and consistency
- **Database connection info**: If it needs to query actual data

Your AI model should return concepts matching the structure shown above.

### 4. Parse AI Response

Convert your AI model's response into `Concept` objects:

```python
from app.models.concept import (
    Concept,
    ConceptAttribute,
    ConceptIDAttribute,
    ConceptCondition
)

# Example: Parse your AI model's JSON response
def parse_ai_response(ai_json: dict, cluster_id: int) -> List[Concept]:
    concepts = []
    
    for concept_data in ai_json.get("concepts", []):
        # Parse ID attributes
        id_attributes = [
            ConceptIDAttribute(
                attributes=[
                    ConceptAttribute(**attr)
                    for attr in id_attr["attributes"]
                ]
            )
            for id_attr in concept_data["idAttributes"]
        ]
        
        # Parse conditions (if any)
        conditions = None
        if "conditions" in concept_data:
            conditions = [
                ConceptCondition(**cond)
                for cond in concept_data["conditions"]
            ]
        
        # Parse sub-concepts recursively (if any)
        sub_concepts = None
        if "subConcepts" in concept_data:
            sub_concepts = parse_ai_response(
                {"concepts": concept_data["subConcepts"]},
                cluster_id
            )
        
        concept = Concept(
            id=concept_data.get("id"),
            name=concept_data.get("name"),
            cluster_id=cluster_id,
            id_attributes=id_attributes,
            attributes=[
                ConceptAttribute(**attr)
                for attr in concept_data.get("attributes", [])
            ] if "attributes" in concept_data else None,
            confidence=concept_data.get("confidence"),
            conditions=conditions,
            sub_concepts=sub_concepts
        )
        
        concepts.append(concept)
    
    return concepts
```

### 5. Report Progress

Use the progress callback to update the frontend:

```python
if progress_callback:
    progress_callback(50, 100, "Analyzing table relationships...")
```

The progress is:
- **current**: Current progress (0-100)
- **total**: Always 100
- **message**: Status message shown to user

## Example: Your Complex JSON

Your example can be created like this:

```python
concept = Concept(
    id_attributes=[
        ConceptIDAttribute(
            attributes=[
                ConceptAttribute(table="Person", column="pid")
            ]
        )
    ],
    sub_concepts=[
        Concept(
            id_attributes=[
                ConceptIDAttribute(
                    attributes=[
                        ConceptAttribute(table="Person", column="pid")
                    ]
                )
            ],
            conditions=[
                ConceptCondition(
                    table="Person",
                    column="type",
                    operator="EQUALS",
                    value="tester"
                )
            ]
        ),
        Concept(
            id_attributes=[
                ConceptIDAttribute(
                    attributes=[
                        ConceptAttribute(table="Person", column="pid")
                    ]
                )
            ],
            conditions=[
                ConceptCondition(
                    table="Person",
                    column="type",
                    operator="EQUALS",
                    value="reviewer"
                )
            ]
        ),
        Concept(
            id_attributes=[
                ConceptIDAttribute(
                    attributes=[
                        ConceptAttribute(table="Person", column="pid")
                    ]
                )
            ],
            conditions=[
                ConceptCondition(
                    table="Person",
                    column="type",
                    operator="EQUALS",
                    value="student"
                )
            ]
        ),
        Concept(
            id_attributes=[
                ConceptIDAttribute(
                    attributes=[
                        ConceptAttribute(table="Person", column="pid")
                    ]
                )
            ],
            conditions=[
                ConceptCondition(
                    table="Person",
                    column="type",
                    operator="EQUALS",
                    value="author"
                )
            ]
        )
    ]
)
```

## Testing

### 1. Start the Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### 2. Test Single Cluster (Synchronous)

```bash
curl -X POST "http://localhost:8000/databases/{db_id}/concepts/cluster/1" \
  -H "Content-Type: application/json" \
  -d '{
    "table_names": ["Person", "Address"],
    "existing_concepts": null
  }'
```

### 3. Test All Clusters (Async with Job)

```bash
# Start job
curl -X POST "http://localhost:8000/databases/{db_id}/concepts/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "clusters": [
      {
        "clusterId": 1,
        "name": "User Cluster",
        "tables": ["Person", "Address"],
        "confidence": 0.9
      }
    ]
  }'

# Response: {"jobId": "some-job-id"}

# Poll status
curl "http://localhost:8000/jobs/some-job-id"
```

### 4. Check Swagger UI

Visit `http://localhost:8000/docs` to see interactive API documentation and test the endpoints.

## Summary

1. **Update** `app/models/concept.py` ✅ (Done - added ConceptCondition model)
2. **Implement** `process_cluster()` in `app/services/concept_service.py`
3. **Call your AI model** to generate concepts from table schemas
4. **Parse response** into `Concept` objects with proper structure
5. **Report progress** via the callback
6. **Test** with both sync and async endpoints

The system will:
- Process clusters sequentially
- Pass previous concepts as context
- Update job results incrementally
- Display concepts in frontend as they're generated

Your main task is implementing the `_generate_concepts_from_tables()` method to call your AI model and parse its response into the Concept structure shown above.
