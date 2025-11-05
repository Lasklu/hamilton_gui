"""Database management endpoints."""

from typing import Annotated
from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import DatabaseServiceDep
from app.core.exceptions import NotFoundError, ValidationError
from app.models.database import Database, DatabaseSchema
from app.models.common import ErrorResponse

router = APIRouter()


@router.post(
    "",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
    },
    summary="Upload database SQL script",
    description="Register a new database by uploading SQL script (DDL/DML).",
)
async def create_database(
    name: Annotated[str, Form()],
    sql_file: Annotated[UploadFile, File(description="SQL script file")],
    service: DatabaseServiceDep,
) -> Database:
    """
    Upload and register a database from SQL script.

    - **name**: Database name
    - **sql_file**: SQL script file (DDL/DML statements)
    """
    # Read SQL content
    sql_content = await sql_file.read()
    sql_text = sql_content.decode("utf-8")

    # Process database
    database = await service.create_database(name=name, sql_content=sql_text)
    return database


@router.post(
    "/from-text",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
    },
    summary="Upload database SQL script as text",
    description="Register a new database from raw SQL text.",
    include_in_schema=True,
)
async def create_database_from_text(
    name: Annotated[str, Form()],
    sql_content: Annotated[str, Form(description="Raw SQL script")],
    service: DatabaseServiceDep,
) -> Database:
    """
    Upload and register a database from raw SQL text.

    - **name**: Database name
    - **sql_content**: Raw SQL script (DDL/DML statements)
    """
    database = await service.create_database(name=name, sql_content=sql_content)
    return database


@router.get(
    "/{database_id}",
    response_model=Database,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Get database metadata",
    description="Retrieve metadata for a registered database.",
)
async def get_database(
    database_id: str,
    service: DatabaseServiceDep,
) -> Database:
    """
    Retrieve database metadata by ID.

    - **database_id**: Database identifier returned by upload endpoint
    """
    database = await service.get_database(database_id)
    return database


@router.get(
    "/{database_id}/schema",
    response_model=DatabaseSchema,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Get database schema metadata",
    description="Retrieve detailed schema information including tables, columns, and their data types.",
)
async def get_database_schema(
    database_id: str,
    service: DatabaseServiceDep,
) -> DatabaseSchema:
    """
    Retrieve detailed database schema metadata.

    - **database_id**: Database identifier
    
    Returns detailed information about:
    - Number of tables
    - Table names and schemas
    - Column names and data types
    - Primary and foreign key information
    """
    schema = await service.get_database_schema(database_id)
    return schema
