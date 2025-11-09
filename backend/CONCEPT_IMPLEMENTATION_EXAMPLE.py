"""
Example implementation of concept generation.

This file shows a complete example of how to implement the _generate_concepts()
method in concept_service.py. This example uses a mock AI model, but you can
replace it with your actual AI model call.
"""

from app.models.concept import (
    Concept,
    ConceptAttribute,
    ConceptIDAttribute,
    ConceptCondition
)
from typing import List, Optional


async def _generate_concepts_EXAMPLE(
    cluster_id: int,
    table_names: List[str],
    database_id: str,
    existing_concepts: Optional[List[Concept]],
    progress_callback=None
) -> List[Concept]:
    """
    Example implementation showing how to generate concepts.
    
    Copy this logic into your concept_service.py and replace the
    mock AI call with your actual AI model.
    """
    
    # Step 1: Report initial progress
    if progress_callback:
        progress_callback(10, 100, "Preparing data for AI model...")
    
    # Step 2: Prepare context from existing concepts (optional)
    context_data = None
    if existing_concepts:
        context_data = {
            "existing_concepts": [
                {
                    "name": c.name,
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
        progress_callback(30, 100, "Calling AI model...")
    
    # Step 3: Call your AI model
    # REPLACE THIS with your actual AI model call:
    #
    # ai_response = await your_ai_model.generate_concepts(
    #     tables=table_names,
    #     database_id=database_id,
    #     context=context_data
    # )
    
    # Mock AI response for demonstration
    ai_response = await mock_ai_model_call(
        table_names=table_names,
        context=context_data
    )
    
    if progress_callback:
        progress_callback(70, 100, "Parsing AI response...")
    
    # Step 4: Parse AI response into Concept objects
    concepts = parse_ai_response(ai_response, cluster_id)
    
    if progress_callback:
        progress_callback(90, 100, f"Validated {len(concepts)} concepts")
    
    return concepts


async def mock_ai_model_call(table_names: List[str], context: dict = None) -> dict:
    """
    Mock AI model that returns example concepts.
    REPLACE THIS with your actual AI model call.
    """
    
    # This simulates what your AI model might return
    # Your AI model should analyze the tables and return similar JSON
    
    if "Person" in table_names:
        # Example: Complex concept with sub-concepts (your exact structure)
        return {
            "concepts": [
                {
                    "id": "person_concept",
                    "name": "Person",
                    "idAttributes": [
                        {
                            "attributes": [
                                {"table": "Person", "column": "pid"}
                            ]
                        }
                    ],
                    "subConcepts": [
                        {
                            "idAttributes": [
                                {
                                    "attributes": [
                                        {"table": "Person", "column": "pid"}
                                    ]
                                }
                            ],
                            "conditions": [
                                {
                                    "table": "Person",
                                    "column": "type",
                                    "operator": "EQUALS",
                                    "value": "tester"
                                }
                            ]
                        },
                        {
                            "idAttributes": [
                                {
                                    "attributes": [
                                        {"table": "Person", "column": "pid"}
                                    ]
                                }
                            ],
                            "conditions": [
                                {
                                    "table": "Person",
                                    "column": "type",
                                    "operator": "EQUALS",
                                    "value": "reviewer"
                                }
                            ]
                        },
                        {
                            "idAttributes": [
                                {
                                    "attributes": [
                                        {"table": "Person", "column": "pid"}
                                    ]
                                }
                            ],
                            "conditions": [
                                {
                                    "table": "Person",
                                    "column": "type",
                                    "operator": "EQUALS",
                                    "value": "student"
                                }
                            ]
                        },
                        {
                            "idAttributes": [
                                {
                                    "attributes": [
                                        {"table": "Person", "column": "pid"}
                                    ]
                                }
                            ],
                            "conditions": [
                                {
                                    "table": "Person",
                                    "column": "type",
                                    "operator": "EQUALS",
                                    "value": "author"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    else:
        # Example: Simple concept for other tables
        return {
            "concepts": [
                {
                    "id": f"{table_names[0].lower()}_concept",
                    "name": table_names[0],
                    "idAttributes": [
                        {
                            "attributes": [
                                {"table": table_names[0], "column": "id"}
                            ]
                        }
                    ],
                    "confidence": 0.85
                }
            ]
        }


def parse_ai_response(ai_response: dict, cluster_id: int) -> List[Concept]:
    """
    Parse your AI model's JSON response into Concept objects.
    
    This handles:
    - ID attributes
    - Regular attributes
    - Conditions
    - Sub-concepts (recursive)
    - Confidence scores
    """
    concepts = []
    
    for concept_data in ai_response.get("concepts", []):
        concept = parse_single_concept(concept_data, cluster_id)
        concepts.append(concept)
    
    return concepts


def parse_single_concept(concept_data: dict, cluster_id: int) -> Concept:
    """
    Parse a single concept from JSON, handling both camelCase and snake_case.
    """
    
    # Parse ID attributes (required)
    id_attrs_data = concept_data.get("idAttributes") or concept_data.get("id_attributes", [])
    id_attributes = [
        ConceptIDAttribute(
            attributes=[
                ConceptAttribute(
                    table=attr["table"],
                    column=attr["column"]
                )
                for attr in id_attr.get("attributes", [])
            ]
        )
        for id_attr in id_attrs_data
    ]
    
    # Parse regular attributes (optional)
    attributes = None
    attrs_data = concept_data.get("attributes")
    if attrs_data:
        attributes = [
            ConceptAttribute(
                table=attr["table"],
                column=attr["column"]
            )
            for attr in attrs_data
        ]
    
    # Parse conditions (optional)
    conditions = None
    cond_data = concept_data.get("conditions")
    if cond_data:
        conditions = [
            ConceptCondition(
                table=cond["table"],
                column=cond["column"],
                operator=cond["operator"],
                value=cond["value"]
            )
            for cond in cond_data
        ]
    
    # Parse sub-concepts recursively (optional)
    sub_concepts = None
    sub_data = concept_data.get("subConcepts") or concept_data.get("sub_concepts")
    if sub_data:
        sub_concepts = [
            parse_single_concept(sub_concept, cluster_id)
            for sub_concept in sub_data
        ]
    
    # Create and return the concept
    return Concept(
        id=concept_data.get("id"),
        name=concept_data.get("name"),
        cluster_id=cluster_id,
        id_attributes=id_attributes,
        attributes=attributes,
        confidence=concept_data.get("confidence"),
        conditions=conditions,
        sub_concepts=sub_concepts,
        joins=concept_data.get("joins")
    )


# ============================================================================
# How to integrate this into your concept_service.py:
# ============================================================================
#
# 1. Copy the _generate_concepts_EXAMPLE function
# 2. Rename it to _generate_concepts (remove _EXAMPLE)
# 3. Replace mock_ai_model_call with your actual AI model:
#
#    ai_response = await your_ai_model.generate_concepts(
#        tables=table_names,
#        database_id=database_id,
#        context=context_data
#    )
#
# 4. Keep the parse_ai_response logic (or adapt it to your AI's output format)
# 5. Test with the endpoints
#
# ============================================================================


# Example of what your AI model should receive:
EXAMPLE_INPUT = {
    "table_names": ["Person", "Address", "Contact"],
    "database_id": "db_abc123",
    "context": {
        "existing_concepts": [
            {
                "name": "Organization",
                "tables": ["Company", "Department"]
            }
        ]
    }
}

# Example of what your AI model should return:
EXAMPLE_OUTPUT = {
    "concepts": [
        {
            "id": "person_concept",
            "name": "Person",
            "idAttributes": [
                {
                    "attributes": [
                        {"table": "Person", "column": "pid"}
                    ]
                }
            ],
            "attributes": [
                {"table": "Person", "column": "name"},
                {"table": "Person", "column": "email"}
            ],
            "confidence": 0.92,
            "subConcepts": [
                {
                    "idAttributes": [
                        {
                            "attributes": [
                                {"table": "Person", "column": "pid"}
                            ]
                        }
                    ],
                    "conditions": [
                        {
                            "table": "Person",
                            "column": "type",
                            "operator": "EQUALS",
                            "value": "employee"
                        }
                    ]
                }
            ]
        }
    ]
}
