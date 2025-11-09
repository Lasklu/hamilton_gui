from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.logging import get_logger
from app.models.clustering import ClusteringSuggestions, ClusteringGroup, ClusteringResult, ClusterInfo
from app.models.common import TableRef
from app.config import settings
from app.db.models import ClusteringResult as DBClusteringResult
from app.core.exceptions import NotFoundError
import asyncio
import json
from functools import partial
from schuyler.solutions.schuyler.execute_schuyler import execute_schuyler
from schuyler.database.database import Database as SchuylerDatabase
from evaluator.experimenter.database_client.postgresclient import PostgresClient
logger = get_logger(__name__)


class ClusteringService:
    """Service for table clustering and grouping suggestions."""

    def __init__(self):
        """Initialize the clustering service."""
        # TODO: Initialize ML models, embedding services, etc.
        pass

    async def generate_clusters(
        self, database_id: str, apply_finetuning: bool = False, progress_callback=None
    ) -> ClusteringResult:
        logger.info(
            f"Generating clusters for database {database_id}, "
            f"finetuning={'enabled' if apply_finetuning else 'disabled'}"
        )

        burr_database = PostgresClient(
            database_id,
            user=settings.POSTGRES_ADMIN_USER,
            password=settings.POSTGRES_ADMIN_PASSWORD,
            host=settings.POSTGRES_ADMIN_HOST,
            port=int(settings.POSTGRES_ADMIN_PORT),
        )
        schuyler_db = SchuylerDatabase(burr_database.user, password=burr_database.password, host=burr_database.host, port=burr_database.port, database=burr_database.database)
        logger.debug("Schuyler DB: %s", schuyler_db)
        
        # Execute clustering in thread pool since it's synchronous and blocking
        # Run the synchronous execute_schuyler in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        clusters = await loop.run_in_executor(
            None,  # Use default executor
            partial(
                execute_schuyler,
                schuyler_db,
                "/home/lukas/burr/Burr/evaluator/experimenter/solutions/hamilton/schuyler/schuyler",
                progress_callback=progress_callback
            )
        )
        
        logger.info("Clusters generated: %s", clusters)
        logger.debug("Fetched tables: %s", burr_database.get_all_tables())
        
        # Convert execute_schuyler output (list of lists of table names) to ClusteringResult
        # Example output: [['table1', 'table2'], ['table3', 'table4', 'table5']]
        cluster_infos = []
        for i, table_names in enumerate(clusters):
            # Create a ClusterInfo with just table names (strings)
            cluster_info = ClusterInfo(
                clusterId=i,
                name=f"Cluster {i + 1}",
                description=None,
                tables=table_names,  # List of table name strings
                confidence=None
            )
            cluster_infos.append(cluster_info)
        
        # Return ClusteringResult (the format the frontend expects)
        return ClusteringResult(
            databaseId=database_id,
            createdAt=datetime.utcnow(),
            clusters=cluster_infos
        )

    async def apply_finetuning(self, database_id: str) -> None:
        """
        Apply finetuning to improve clustering for a specific database.

        Args:
            database_id: Database identifier

        Raises:
            NotFoundError: If database not found
        """
        logger.info(f"Applying finetuning for database {database_id}")
        
        # TODO: Implement finetuning logic
        
        raise NotImplementedError("Finetuning logic not yet implemented")

    async def save_clustering(
        self,
        db: Session,
        database_id: str,
        clustering_result: ClusteringResult,
        name: str,
        applied_finetuning: bool = False,
        set_active: bool = True
    ) -> int:
        """
        Save clustering result to metadata database.
        
        Args:
            db: Database session
            database_id: Database identifier
            clustering_result: The clustering result to save
            name: User-friendly name for this clustering
            applied_finetuning: Whether finetuning was applied
            set_active: If True, sets this as the active clustering and deactivates others
            
        Returns:
            ID of the saved clustering result
        """
        # If setting as active, deactivate all other clusterings for this database
        if set_active:
            db.query(DBClusteringResult).filter(
                DBClusteringResult.database_id == database_id
            ).update({"is_active": False})
        
        # Convert ClusterInfo objects to JSON-serializable dicts
        clusters_json = [
            {
                "clusterId": cluster.cluster_id,
                "name": cluster.name,
                "description": cluster.description,
                "tables": cluster.tables,
                "confidence": cluster.confidence
            }
            for cluster in clustering_result.clusters
        ]
        
        # Create database model
        db_clustering = DBClusteringResult(
            database_id=database_id,
            name=name,
            algorithm="schuyler",
            parameters=None,
            applied_finetuning=applied_finetuning,
            cluster_count=len(clustering_result.clusters),
            clusters=json.dumps(clusters_json),
            is_active=set_active
        )
        
        db.add(db_clustering)
        db.commit()
        db.refresh(db_clustering)
        
        logger.info(f"Saved clustering '{name}' for database {database_id} (ID: {db_clustering.id})")
        return db_clustering.id
    
    async def get_clustering(
        self,
        db: Session,
        clustering_id: int
    ) -> ClusteringResult:
        """
        Load a saved clustering result.
        
        Args:
            db: Database session
            clustering_id: ID of the clustering to load
            
        Returns:
            ClusteringResult object
            
        Raises:
            NotFoundError: If clustering not found
        """
        db_clustering = db.query(DBClusteringResult).filter(
            DBClusteringResult.id == clustering_id
        ).first()
        
        if not db_clustering:
            raise NotFoundError(f"Clustering {clustering_id} not found")
        
        # Parse clusters JSON
        clusters_data = json.loads(db_clustering.clusters) if isinstance(db_clustering.clusters, str) else db_clustering.clusters
        
        clusters = [
            ClusterInfo(
                clusterId=c["clusterId"],
                name=c["name"],
                description=c.get("description"),
                tables=c["tables"],
                confidence=c.get("confidence")
            )
            for c in clusters_data
        ]
        
        return ClusteringResult(
            databaseId=db_clustering.database_id,
            createdAt=db_clustering.created_at.isoformat(),
            clusters=clusters
        )
    
    async def list_clusterings(
        self,
        db: Session,
        database_id: str
    ) -> List[dict]:
        """
        List all saved clusterings for a database.
        
        Args:
            db: Database session
            database_id: Database identifier
            
        Returns:
            List of clustering summaries
        """
        clusterings = db.query(DBClusteringResult).filter(
            DBClusteringResult.database_id == database_id
        ).order_by(DBClusteringResult.created_at.desc()).all()
        
        return [
            {
                "id": c.id,
                "name": c.name,
                "clusterCount": c.cluster_count,
                "appliedFinetuning": c.applied_finetuning,
                "isActive": c.is_active,
                "createdAt": c.created_at.isoformat()
            }
            for c in clusterings
        ]
    
    async def get_active_clustering(
        self,
        db: Session,
        database_id: str
    ) -> Optional[ClusteringResult]:
        """
        Get the currently active clustering for a database.
        
        Args:
            db: Database session
            database_id: Database identifier
            
        Returns:
            ClusteringResult if an active clustering exists, None otherwise
        """
        db_clustering = db.query(DBClusteringResult).filter(
            DBClusteringResult.database_id == database_id,
            DBClusteringResult.is_active == True
        ).first()
        
        if not db_clustering:
            return None
        
        return await self.get_clustering(db, db_clustering.id)
    
    async def set_active_clustering(
        self,
        db: Session,
        clustering_id: int
    ) -> None:
        """
        Set a clustering as the active one for its database.
        
        Args:
            db: Database session
            clustering_id: ID of the clustering to activate
            
        Raises:
            NotFoundError: If clustering not found
        """
        db_clustering = db.query(DBClusteringResult).filter(
            DBClusteringResult.id == clustering_id
        ).first()
        
        if not db_clustering:
            raise NotFoundError(f"Clustering {clustering_id} not found")
        
        # Deactivate all clusterings for this database
        db.query(DBClusteringResult).filter(
            DBClusteringResult.database_id == db_clustering.database_id
        ).update({"is_active": False})
        
        # Activate the selected one
        db_clustering.is_active = True
        db.commit()
        
        logger.info(f"Set clustering {clustering_id} as active for database {db_clustering.database_id}")
