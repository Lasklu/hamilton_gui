"""Service layer for database operations."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import uuid

from app.db.models import DatabaseMetadata, DatabaseProvider, DatabaseStatus
from app.db.connection_manager import connection_manager
from app.models.database import Database, DatabaseSchema
from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.config import settings

logger = get_logger(__name__)


class DatabaseService:
    """Service for managing database metadata and connections."""
    
    def __init__(self, db: Session):
        """Initialize the database service with a database session."""
        self.db = db
    
    def _generate_id(self) -> str:
        """Generate a unique database ID."""
        return f"db_{uuid.uuid4().hex[:10]}"
    
    async def create_database(
        self,
        name: str,
        sql_content: Optional[str] = None,
        provider: str = "postgresql",
        database_name: Optional[str] = None,
        create_if_not_exists: bool = True
    ) -> Database:
        """
        Create a new database entry and optionally create the actual database.
        Uses admin credentials from config to create the database.
        
        Args:
            name: Display name for the database
            sql_content: SQL script to execute (optional)
            provider: Database provider (postgresql, mysql, etc.)
            database_name: Name of the database on the server (optional, auto-generated)
            create_if_not_exists: Create the database if it doesn't exist
            create_if_not_exists: Create the database if it doesn't exist
        
        Returns:
            Database metadata
            
        Raises:
            ValidationError: If database creation fails
        """
        logger.info(f"Creating database: {name}")
        
        try:
            # Generate unique ID
            db_id = self._generate_id()
            
            # Convert provider string to enum
            try:
                provider_enum = DatabaseProvider[provider.upper()]
            except KeyError:
                raise ValidationError(f"Unsupported database provider: {provider}")
            
            # Use admin credentials from config for PostgreSQL
            if provider_enum == DatabaseProvider.POSTGRESQL:
                host = settings.POSTGRES_ADMIN_HOST
                port = settings.POSTGRES_ADMIN_PORT
                username = settings.POSTGRES_ADMIN_USER
                password = settings.POSTGRES_ADMIN_PASSWORD
                database_name = database_name or db_id
            else:
                raise ValidationError(f"Provider {provider} not yet implemented")
            
            # Create database on server if requested
            if create_if_not_exists:
                try:
                    connection_manager.create_database(
                        provider=provider_enum,
                        host=host,
                        port=port,
                        database_name=database_name,
                        username=username,
                        password=password
                    )
                    logger.info(f"Created database {database_name} on {host}:{port}")
                except Exception as e:
                    logger.warning(f"Database creation skipped or failed: {str(e)}")
            
            # Create connection string
            connection_string = connection_manager.create_connection_string(
                provider=provider_enum,
                host=host,
                port=port,
                database_name=database_name,
                username=username,
                password=password
            )
            
            # Test connection
            engine = connection_manager.connect(
                database_id=db_id,
                provider=provider_enum,
                connection_string=connection_string
            )
            logger.info(f"Successfully connected to database {database_name}")
            
            # Execute SQL if provided
            if sql_content:
                logger.info(f"Executing SQL script for database {database_name}")
                connection_manager.execute_sql(engine, sql_content)
            
            # Get schema information
            schema_info = connection_manager.get_schema_info(engine)
            logger.info(f"Extracted schema with {schema_info['tableCount']} tables")
            
            # Create metadata entry
            db_metadata = DatabaseMetadata(
                id=db_id,
                name=name,
                provider=provider_enum,
                host=host,
                port=port,
                database_name=database_name,
                username=username,
                password=password,  # TODO: Encrypt in production
                connection_string=connection_string,
                status=DatabaseStatus.CONNECTED,
                table_count=schema_info['tableCount'],
                schema_json=schema_info,
                sql_content=sql_content,
                last_connected_at=datetime.utcnow()
            )
            
            self.db.add(db_metadata)
            self.db.commit()
            self.db.refresh(db_metadata)
            
            logger.info(f"Successfully created database metadata for {name}")
            return self._to_database_model(db_metadata)
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create database: {str(e)}")
            raise ValidationError(f"Failed to create database: {str(e)}")
    
    async def get_database(self, database_id: str) -> Database:
        """
        Retrieve database metadata by ID.

        Args:
            database_id: Database identifier

        Returns:
            Database metadata

        Raises:
            NotFoundError: If database not found
        """
        logger.info(f"Retrieving database: {database_id}")
        
        db_metadata = self.db.query(DatabaseMetadata).filter(
            DatabaseMetadata.id == database_id
        ).first()
        
        if not db_metadata:
            raise NotFoundError(f"Database {database_id} not found")
        
        return self._to_database_model(db_metadata)
    
    async def list_databases(self) -> List[Database]:
        """List all databases."""
        logger.info("Listing all databases")
        databases = self.db.query(DatabaseMetadata).all()
        return [self._to_database_model(db) for db in databases]
    
    async def get_database_schema(self, database_id: str) -> DatabaseSchema:
        """
        Retrieve detailed database schema metadata.

        Args:
            database_id: Database identifier

        Returns:
            DatabaseSchema with tables and columns

        Raises:
            NotFoundError: If database not found
        """
        logger.info(f"Retrieving schema for database: {database_id}")
        
        db_metadata = self.db.query(DatabaseMetadata).filter(
            DatabaseMetadata.id == database_id
        ).first()
        
        if not db_metadata:
            raise NotFoundError(f"Database {database_id} not found")
        
        # Try to get fresh schema from connection
        engine = connection_manager.get_connection(database_id)
        
        if engine:
            try:
                schema_info = connection_manager.get_schema_info(engine)
                
                # Update stored schema
                db_metadata.schema_json = schema_info
                db_metadata.table_count = schema_info['tableCount']
                db_metadata.last_connected_at = datetime.utcnow()
                self.db.commit()
                
                logger.info(f"Retrieved fresh schema with {schema_info['tableCount']} tables")
                return DatabaseSchema(
                    databaseId=database_id,
                    tableCount=schema_info['tableCount'],
                    tables=schema_info['tables']
                )
            except Exception as e:
                logger.warning(f"Failed to get fresh schema, using cached: {str(e)}")
        
        # Return cached schema
        if db_metadata.schema_json:
            # Ensure all tables have a 'schema' field (for backward compatibility)
            tables = db_metadata.schema_json.get('tables', [])
            for table in tables:
                if 'schema' not in table:
                    table['schema'] = 'public'  # Add default schema if missing
            
            return DatabaseSchema(
                databaseId=database_id,
                tableCount=db_metadata.table_count,
                tables=tables
            )
        
        raise ValidationError("No schema information available")
    
    async def delete_database(self, database_id: str) -> None:
        """
        Delete a database metadata (does not drop the actual database).

        Args:
            database_id: Database identifier

        Raises:
            NotFoundError: If database not found
        """
        logger.info(f"Deleting database: {database_id}")
        
        db_metadata = self.db.query(DatabaseMetadata).filter(
            DatabaseMetadata.id == database_id
        ).first()
        
        if not db_metadata:
            raise NotFoundError(f"Database {database_id} not found")
        
        # Attempt to drop the actual database on the server (if supported)
        try:
            provider_enum = DatabaseProvider(db_metadata.provider)
        except Exception:
            provider_enum = None

        if provider_enum == DatabaseProvider.POSTGRESQL:
            try:
                logger.info(
                    "Dropping actual PostgreSQL database %s on %s:%s",
                    db_metadata.database_name,
                    db_metadata.host,
                    db_metadata.port,
                )

                connection_manager.drop_database(
                    provider=provider_enum,
                    host=db_metadata.host,
                    port=db_metadata.port,
                    database_name=db_metadata.database_name,
                    username=db_metadata.username,
                    password=db_metadata.password,
                    admin_database=settings.POSTGRES_ADMIN_DATABASE,
                )
                logger.info("Successfully dropped database %s", db_metadata.database_name)
            except Exception as e:
                logger.error(f"Failed to drop actual database: {str(e)}")
                # Raise a ValidationError to avoid deleting metadata while the DB still exists
                raise ValidationError(f"Failed to drop database on server: {str(e)}")

        # Disconnect any pooled connection and delete metadata
        connection_manager.disconnect(database_id)
        self.db.delete(db_metadata)
        self.db.commit()

        logger.info(f"Successfully deleted database metadata for {database_id}")
    
    async def test_connection(self, database_id: str) -> bool:
        """Test if database connection is still valid."""
        logger.info(f"Testing connection for database: {database_id}")
        
        db_metadata = self.db.query(DatabaseMetadata).filter(
            DatabaseMetadata.id == database_id
        ).first()
        
        if not db_metadata:
            raise NotFoundError(f"Database {database_id} not found")
        
        try:
            # Try to reconnect
            engine = connection_manager.connect(
                database_id=database_id,
                provider=DatabaseProvider(db_metadata.provider),
                connection_string=db_metadata.connection_string
            )
            
            # Update status
            db_metadata.status = DatabaseStatus.CONNECTED
            db_metadata.last_connected_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Connection test successful for {database_id}")
            return True
        except Exception as e:
            logger.error(f"Connection test failed for {database_id}: {str(e)}")
            db_metadata.status = DatabaseStatus.FAILED
            self.db.commit()
            return False
    
    def _to_database_model(self, db_metadata: DatabaseMetadata) -> Database:
        """Convert DatabaseMetadata to Database model."""
        return Database(
            id=db_metadata.id,
            name=db_metadata.name,
            createdAt=db_metadata.created_at.isoformat(),
            tableCount=db_metadata.table_count,
            status=db_metadata.status
        )
