"""Database connection management for target databases."""

from typing import Optional, Dict, Any
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import Engine
from urllib.parse import quote_plus
import logging

from app.db.models import DatabaseProvider

logger = logging.getLogger(__name__)


class DatabaseConnectionManager:
    """Manages connections to target databases (PostgreSQL, MySQL, etc.)."""
    
    def __init__(self):
        self._connections: Dict[str, Engine] = {}
    
    def create_connection_string(
        self,
        provider: DatabaseProvider,
        host: str,
        port: int,
        database_name: str,
        username: str,
        password: str,
        **kwargs
    ) -> str:
        """Create a connection string for the given provider."""
        encoded_password = quote_plus(password)
        
        if provider == DatabaseProvider.POSTGRESQL:
            return f"postgresql://{username}:{encoded_password}@{host}:{port}/{database_name}"
        elif provider == DatabaseProvider.MYSQL:
            return f"mysql+pymysql://{username}:{encoded_password}@{host}:{port}/{database_name}"
        elif provider == DatabaseProvider.SQLITE:
            return f"sqlite:///{database_name}"
        elif provider == DatabaseProvider.SQLSERVER:
            return f"mssql+pyodbc://{username}:{encoded_password}@{host}:{port}/{database_name}?driver=ODBC+Driver+17+for+SQL+Server"
        else:
            raise ValueError(f"Unsupported database provider: {provider}")
    
    def connect(
        self,
        database_id: str,
        provider: DatabaseProvider,
        connection_string: Optional[str] = None,
        **conn_params
    ) -> Engine:
        """
        Create and test a database connection.
        
        Args:
            database_id: Unique identifier for this connection
            provider: Database provider type
            connection_string: Full connection string (optional)
            **conn_params: Connection parameters (host, port, database_name, username, password)
        
        Returns:
            SQLAlchemy Engine instance
        
        Raises:
            ConnectionError: If connection fails
        """
        try:
            # Use provided connection string or build one
            if not connection_string:
                connection_string = self.create_connection_string(provider, **conn_params)
            
            # Create engine
            engine = create_engine(
                connection_string,
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,   # Recycle connections after 1 hour
                echo=False
            )
            
            # Test connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Store connection
            self._connections[database_id] = engine
            logger.info(f"Successfully connected to database {database_id}")
            
            return engine
            
        except Exception as e:
            logger.error(f"Failed to connect to database {database_id}: {str(e)}")
            raise ConnectionError(f"Failed to connect to database: {str(e)}")
    
    def get_connection(self, database_id: str) -> Optional[Engine]:
        """Get existing connection by database ID."""
        return self._connections.get(database_id)
    
    def disconnect(self, database_id: str) -> None:
        """Disconnect and remove a database connection."""
        if database_id in self._connections:
            self._connections[database_id].dispose()
            del self._connections[database_id]
            logger.info(f"Disconnected from database {database_id}")
    
    def get_schema_info(self, engine: Engine) -> Dict[str, Any]:
        """
        Extract schema information from a database connection.
        
        Returns:
            Dictionary with tables and columns information
        """
        inspector = inspect(engine)
        tables = []
        
        for table_name in inspector.get_table_names():
            columns = []
            primary_keys = inspector.get_pk_constraint(table_name)
            foreign_keys = inspector.get_foreign_keys(table_name)
            
            # Build foreign key lookup
            fk_lookup = {}
            for fk in foreign_keys:
                for col in fk.get('constrained_columns', []):
                    fk_lookup[col] = {
                        'table': fk.get('referred_table'),
                        'column': fk.get('referred_columns', [])[0] if fk.get('referred_columns') else None
                    }
            
            for column in inspector.get_columns(table_name):
                col_name = column['name']
                col_type = str(column['type'])
                
                columns.append({
                    'name': col_name,
                    'dataType': col_type,
                    'isPrimaryKey': col_name in primary_keys.get('constrained_columns', []),
                    'isForeignKey': col_name in fk_lookup,
                    'isNullable': column.get('nullable', True),
                    'defaultValue': column.get('default'),
                    'referencedTable': fk_lookup.get(col_name, {}).get('table'),
                    'referencedColumn': fk_lookup.get(col_name, {}).get('column')
                })
            
            tables.append({
                'name': table_name,
                'schema': 'public',  # Default schema for PostgreSQL
                'columns': columns
            })
        
        return {
            'tableCount': len(tables),
            'tables': tables
        }
    
    def create_database(
        self,
        provider: DatabaseProvider,
        host: str,
        port: int,
        database_name: str,
        username: str,
        password: str,
        admin_database: str = "postgres"
    ) -> None:
        """
        Create a new database on the server.
        
        Args:
            provider: Database provider
            host: Server host
            port: Server port
            database_name: Name of database to create
            username: Admin username
            password: Admin password
            admin_database: Admin database to connect to (default 'postgres' for PostgreSQL)
        """
        if provider == DatabaseProvider.POSTGRESQL:
            # Connect to admin database
            conn_string = f"postgresql://{username}:{quote_plus(password)}@{host}:{port}/{admin_database}"
            engine = create_engine(conn_string, isolation_level="AUTOCOMMIT")
            
            try:
                with engine.connect() as conn:
                    # Check if database exists
                    result = conn.execute(
                        text(f"SELECT 1 FROM pg_database WHERE datname = '{database_name}'")
                    )
                    if result.fetchone():
                        logger.info(f"Database {database_name} already exists")
                        return
                    
                    # Create database
                    conn.execute(text(f"CREATE DATABASE {database_name}"))
                    logger.info(f"Created PostgreSQL database: {database_name}")
            finally:
                engine.dispose()
        else:
            raise NotImplementedError(f"Database creation not implemented for {provider}")

    def drop_database(
        self,
        provider: DatabaseProvider,
        host: str,
        port: int,
        database_name: str,
        username: str,
        password: str,
        admin_database: str = "postgres",
    ) -> None:
        """
        Drop a database on the server. For PostgreSQL this will terminate active
        connections to the target database before attempting to drop it.

        Args:
            provider: Database provider
            host: Server host
            port: Server port
            database_name: Name of database to drop
            username: Admin username
            password: Admin password
            admin_database: Admin database to connect to (default 'postgres')
        """
        if provider == DatabaseProvider.POSTGRESQL:
            conn_string = f"postgresql://{username}:{quote_plus(password)}@{host}:{port}/{admin_database}"
            engine = create_engine(conn_string, isolation_level="AUTOCOMMIT")

            try:
                with engine.connect() as conn:
                    # Terminate other connections to the database
                    try:
                        conn.execute(
                            text(
                                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :db AND pid <> pg_backend_pid();"
                            ),
                            {"db": database_name},
                        )
                    except Exception:
                        # Best-effort; proceed to drop even if we couldn't terminate all sessions
                        logger.warning(
                            "Could not terminate sessions for database %s; attempting to DROP anyway",
                            database_name,
                        )

                    # Drop database if it exists
                    try:
                        conn.execute(text(f"DROP DATABASE IF EXISTS {database_name}"))
                        logger.info(f"Dropped PostgreSQL database: {database_name}")
                    except Exception as e:
                        logger.error(f"Failed to drop database {database_name}: {str(e)}")
                        raise
            finally:
                engine.dispose()
        else:
            raise NotImplementedError(f"Database drop not implemented for {provider}")
    
    def execute_sql(self, engine: Engine, sql_content: str) -> None:
        """
        Execute SQL statements on the database.
        
        Args:
            engine: Database engine
            sql_content: SQL statements to execute
        """
        with engine.connect() as conn:
            # Split SQL into statements and execute each
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            
            for statement in statements:
                try:
                    conn.execute(text(statement))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Failed to execute statement: {statement[:100]}... Error: {str(e)}")
                    conn.rollback()


# Global connection manager instance
connection_manager = DatabaseConnectionManager()
