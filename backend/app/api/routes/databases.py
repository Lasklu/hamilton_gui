"""Database management endpoints."""

from typing import Annotated, List, Optional
from fastapi import APIRouter, File, Form, UploadFile, status, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.deps import DatabaseServiceDep
from app.core.exceptions import NotFoundError, ValidationError
from app.models.database import Database, DatabaseSchema
from app.models.common import ErrorResponse

router = APIRouter()


class CreateDatabaseRequest(BaseModel):
    """Request model for creating a database."""
    name: str
    database_name: Optional[str] = None  # Name in PostgreSQL, auto-generated if not provided
    sql_content: Optional[str] = None
    create_if_not_exists: bool = True


@router.post(
    "",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
    },
    summary="Create a new database",
    description="Create a new database on a database server and register it.",
)
async def create_database(
    request: CreateDatabaseRequest,
    service: DatabaseServiceDep,
) -> Database:
    """
    Create a new database on a database server and register it.

    - **name**: Display name for the database
    - **database_name**: Name of the database in PostgreSQL (optional, will be auto-generated)
    - **sql_content**: Optional SQL script to execute after creation
    - **create_if_not_exists**: Create the database if it doesn't exist
    """
    database = await service.create_database(
        name=request.name,
        sql_content=request.sql_content,
        provider="postgresql",
        database_name=request.database_name,
        create_if_not_exists=request.create_if_not_exists
    )
    return database


@router.post(
    "/upload",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
    },
    summary="Upload database SQL script",
    description="Register a new database by uploading SQL script (DDL/DML).",
)
async def upload_database(
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

    # Process database (creates SQLite database by default)
    database = await service.create_database(
        name=name,
        sql_content=sql_text,
        provider="sqlite",
        database_name=f"{name}.db"
    )
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
    "",
    response_model=List[Database],
    summary="List all databases",
    description="Retrieve a list of all registered databases.",
)
async def list_databases(
    service: DatabaseServiceDep,
) -> List[Database]:
    """
    List all registered databases.
    
    Returns a list of all databases with their metadata.
    """
    databases = await service.list_databases()
    return databases


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

    - **database_id**: Database identifier returned by create endpoint
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


@router.delete(
    "/{database_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="Delete database metadata",
    description="Delete database metadata. Note: This does not drop the actual database on the server.",
)
async def delete_database(
    database_id: str,
    service: DatabaseServiceDep,
) -> None:
    """
    Delete database metadata.

    - **database_id**: Database identifier
    
    Note: This only removes the metadata from the system.
    It does NOT drop the actual database on the PostgreSQL server.
    """
    await service.delete_database(database_id)
