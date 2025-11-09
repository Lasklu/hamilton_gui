# Quick Reference: Concept Generation

## Your Implementation Function

**File**: `/backend/app/services/concept_service.py`
**Method**: `_generate_concepts()`

### Input Parameters

```python
cluster_id: int              # e.g., 1, 2, 3...
table_names: List[str]       # e.g., ["Person", "Address", "Contact"]
database_id: str             # e.g., "db_abc123"
existing_concepts: List[Concept] | None  # Concepts from previous clusters
progress_callback: function  # progress_callback(current, total, message)
```

### Expected Return

```python
List[Concept]  # List of Concept objects
```

## Creating a Simple Concept

```python
from app.models.concept import Concept, ConceptAttribute, ConceptIDAttribute

concept = Concept(
    id_attributes=[
        ConceptIDAttribute(
            attributes=[
                ConceptAttribute(table="Person", column="id")
            ]
        )
    ]
)
```

## Creating a Concept with Conditions

```python
from app.models.concept import ConceptCondition

concept = Concept(
    id_attributes=[
        ConceptIDAttribute(
            attributes=[
                ConceptAttribute(table="Person", column="id")
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
)
```

## Creating a Concept with Sub-Concepts

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
        )
    ]
)
```

## Your Exact JSON Example as Code

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

## Implementation Checklist

- [ ] Replace `_generate_concepts()` method
- [ ] Call your AI model with `table_names` and `database_id`
- [ ] Parse AI response into `Concept` objects
- [ ] Use `progress_callback()` to report progress
- [ ] Return `List[Concept]`
- [ ] Test with single cluster endpoint
- [ ] Test with full generation endpoint

## Testing Commands

### Test Single Cluster (Sync)
```bash
curl -X POST "http://localhost:8000/databases/YOUR_DB_ID/concepts/cluster/1" \
  -H "Content-Type: application/json" \
  -d '{
    "table_names": ["Person", "Address"],
    "existing_concepts": null
  }'
```

### Test All Clusters (Async)
```bash
# Start job
curl -X POST "http://localhost:8000/databases/YOUR_DB_ID/concepts/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "clusters": [
      {
        "clusterId": 1,
        "name": "People",
        "tables": ["Person", "Address"],
        "confidence": 0.9
      }
    ]
  }'

# Get job status
curl "http://localhost:8000/jobs/JOB_ID"
```

## Common Operators for Conditions

- `EQUALS`
- `NOT_EQUALS`
- `GREATER_THAN`
- `LESS_THAN`
- `GREATER_THAN_OR_EQUALS`
- `LESS_THAN_OR_EQUALS`
- `IN`
- `NOT_IN`
- `LIKE`
- `NOT_LIKE`
- `IS_NULL`
- `IS_NOT_NULL`

## Progress Reporting

```python
# At different stages of your implementation
progress_callback(0, 100, "Starting analysis...")
progress_callback(25, 100, "Calling AI model...")
progress_callback(50, 100, "Processing results...")
progress_callback(75, 100, "Creating concept objects...")
progress_callback(100, 100, "Complete!")
```

## Next Steps

1. Open `/backend/app/services/concept_service.py`
2. Find the `_generate_concepts()` method
3. Replace the TODO comments with your implementation
4. Test using the commands above
5. Check `/backend/CONCEPT_GENERATION_IMPLEMENTATION_GUIDE.md` for full details
