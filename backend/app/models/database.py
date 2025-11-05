"""Database-related models."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class Database(BaseModel):
    """Database metadata model."""

    id: str = Field(..., description="Unique database identifier")
    name: str = Field(..., description="Database name")
    created_at: datetime = Field(
        ..., alias="createdAt", description="Creation timestamp"
    )

    class Config:
        populate_by_name = True


class DatabaseCreateRequest(BaseModel):
    """Request model for creating a database (multipart/form-data)."""

    name: str = Field(..., description="Database name")
    # sql_file will be handled separately as UploadFile in the endpoint


class ColumnMetadata(BaseModel):
    """Column metadata information."""

    name: str = Field(..., description="Column name")
    data_type: str = Field(..., alias="dataType", description="Column data type")
    nullable: Optional[bool] = Field(None, description="Whether column allows NULL")
    is_primary_key: Optional[bool] = Field(
        None, alias="isPrimaryKey", description="Whether column is part of primary key"
    )
    is_foreign_key: Optional[bool] = Field(
        None, alias="isForeignKey", description="Whether column is a foreign key"
    )
    foreign_key_reference: Optional[str] = Field(
        None,
        alias="foreignKeyReference",
        description="Foreign key reference (table.column format)",
    )
    default_value: Optional[str] = Field(
        None, alias="defaultValue", description="Default value if any"
    )

    class Config:
        populate_by_name = True


class TableMetadata(BaseModel):
    """Table metadata information."""

    schema_: str = Field(..., alias="schema", description="Schema name")
    name: str = Field(..., description="Table name")
    column_count: Optional[int] = Field(
        None, alias="columnCount", description="Number of columns in table"
    )
    columns: List[ColumnMetadata] = Field(..., description="List of columns")

    class Config:
        populate_by_name = True


class DatabaseSchema(BaseModel):
    """Complete database schema metadata."""

    database_id: str = Field(..., alias="databaseId", description="Database identifier")
    table_count: int = Field(..., alias="tableCount", description="Total number of tables")
    tables: List[TableMetadata] = Field(..., description="List of tables with columns")

    class Config:
        populate_by_name = True
