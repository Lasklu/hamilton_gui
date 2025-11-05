"""Ontology generation endpoints."""

from typing import List, Union
from fastapi import APIRouter, Body, Query, status

from app.api.deps import OntologyServiceDep
from app.models.ontology import (
    AttributesRequest,
    ConceptJSON,
    ConceptWithLikelihood,
    ObjectPropertyJSON,
    ObjectPropertyWithLikelihood,
    RelationshipsRequest,
    ScopedRequest,
)
from app.models.common import ErrorResponse

router = APIRouter()


@router.post(
    "/concepts",
    response_model=Union[List[ConceptJSON], List[ConceptWithLikelihood]],
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate ontology concepts for given tables",
    description=(
        "Input scope is {databaseId, tables}. Returns **only concepts** (parser-ready). "
        "With samples=1, returns array of concepts. With samples>1, returns array of "
        "{concept, likelihood}."
    ),
)
async def generate_concepts(
    request: ScopedRequest = Body(...),
    samples: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Number of stochastic generations to sample",
    ),
    service: OntologyServiceDep = None,
) -> Union[List[ConceptJSON], List[ConceptWithLikelihood]]:
    """
    Generate ontology concepts for the specified tables.

    - **databaseId**: Database identifier
    - **tables**: List of tables to analyze
    - **modelingHints**: Optional domain hints, aliases, constraints
    - **samples**: Number of samples (1 = single result, >1 = probabilistic list)
    """
    result = await service.generate_concepts(request=request, samples=samples)
    return result


@router.post(
    "/attributes",
    response_model=Union[ConceptJSON, List[ConceptWithLikelihood]],
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate/augment attributes for a given concept and tables",
    description=(
        "Provide {databaseId, tables} and a **ConceptJSON seed**. "
        "Returns the **concept including populated `attributes`** "
        "(and optionally `id_attributes`, joins, etc.). "
        "With samples>1, returns a list of {concept (with attributes), likelihood}."
    ),
)
async def generate_attributes(
    request: AttributesRequest = Body(...),
    samples: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Number of stochastic generations to sample",
    ),
    service: OntologyServiceDep = None,
) -> Union[ConceptJSON, List[ConceptWithLikelihood]]:
    """
    Generate or augment attributes for a concept.

    - **databaseId**: Database identifier
    - **tables**: List of tables to analyze
    - **concept**: Seed concept to be augmented with attributes
    - **modelingHints**: Optional hints
    - **samples**: Number of samples (1 = single concept, >1 = probabilistic list)
    """
    result = await service.generate_attributes(request=request, samples=samples)
    return result


@router.post(
    "/relationships",
    response_model=Union[List[ObjectPropertyJSON], List[ObjectPropertyWithLikelihood]],
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Generate ALL relationships (object properties) for given concepts & attributes",
    description=(
        "Provide {databaseId, tables}, the **concepts** (identified by id_attributes), "
        "and the **attributes** you already know for those concepts. "
        "Returns **only object_properties**. "
        "With samples>1, returns a probabilistic list."
    ),
)
async def generate_relationships(
    request: RelationshipsRequest = Body(...),
    samples: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Number of stochastic generations to sample",
    ),
    service: OntologyServiceDep = None,
) -> Union[List[ObjectPropertyJSON], List[ObjectPropertyWithLikelihood]]:
    """
    Generate relationships (object properties) between concepts.

    - **databaseId**: Database identifier
    - **tables**: List of tables to analyze
    - **concepts**: Concepts identified by id_attributes
    - **attributes**: Known attributes for the concepts
    - **modelingHints**: Optional cardinality hints, FK conventions
    - **samples**: Number of samples (1 = single result, >1 = probabilistic list)
    """
    result = await service.generate_relationships(request=request, samples=samples)
    return result
