"""Mock API endpoints for testing without backend logic implementation."""

import asyncio
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, File, Form, UploadFile, status, Body, HTTPException

from app.models.database import Database, DatabaseSchema, ColumnMetadata, TableMetadata
from app.models.clustering import (
    ClusteringSuggestions,
    ClusteringGroup,
    ClusterRequest,
    ClusteringResult,
    ClusterInfo,
)
from app.models.concept import Concept, ConceptSuggestion, ConceptAttribute, ConceptIDAttribute, ConceptCondition
from app.models.relationship import Relationship, RelationshipConfirmRequest
from app.models.common import ErrorResponse, TableRef
from app.models.job import JobType, JobCreateResponse, JobStatus
from app.core.job_manager import job_manager

router = APIRouter(prefix="/mock")


# Mock data
MOCK_DATABASES = {}
MOCK_DATABASE_COUNTER = 1


@router.get(
    "/databases",
    response_model=list[Database],
    summary="[MOCK] List all databases",
    description="Mock endpoint that returns a list of all registered databases.",
)
async def mock_list_databases() -> list[Database]:
    """
    Mock list databases endpoint.
    Returns all mock databases that have been created.
    """
    return list(MOCK_DATABASES.values())


@router.post(
    "/databases/connect",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid connection string"},
    },
    summary="[MOCK] Connect to a database",
    description="Mock endpoint that simulates connecting to a database via connection string.",
)
async def mock_connect_database(
    name: Annotated[str, Body()],
    connectionString: Annotated[str, Body()],
) -> Database:
    """
    Mock database connection endpoint.
    Returns fake database metadata without actually connecting.
    """
    global MOCK_DATABASE_COUNTER
    
    database_id = f"db_{MOCK_DATABASE_COUNTER}"
    MOCK_DATABASE_COUNTER += 1
    
    db = Database(
        id=database_id,
        name=name,
        created_at=datetime.now()
    )
    
    MOCK_DATABASES[database_id] = db
    return db


@router.post(
    "/databases",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
    },
    summary="[MOCK] Upload database SQL script",
    description="Mock endpoint that returns fake database metadata without processing SQL.",
)
async def mock_create_database(
    name: Annotated[str, Form()],
    sql_file: Annotated[UploadFile, File(description="SQL script file")],
) -> Database:
    """
    Mock database upload endpoint.
    Returns a fake database object without actually processing the SQL file.
    """
    global MOCK_DATABASE_COUNTER
    
    db_id = f"db_{MOCK_DATABASE_COUNTER:06d}"
    MOCK_DATABASE_COUNTER += 1
    
    database = Database(
        id=db_id,
        name=name,
        createdAt=datetime.now()
    )
    
    MOCK_DATABASES[db_id] = database
    return database


@router.post(
    "/databases/from-text",
    response_model=Database,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
    },
    summary="[MOCK] Upload database SQL script as text",
    description="Mock endpoint that returns fake database metadata without processing SQL text.",
)
async def mock_create_database_from_text(
    name: Annotated[str, Form()],
    sql_content: Annotated[str, Form(description="Raw SQL script")],
) -> Database:
    """
    Mock database upload from text endpoint.
    Returns a fake database object without actually processing the SQL.
    """
    global MOCK_DATABASE_COUNTER
    
    db_id = f"db_{MOCK_DATABASE_COUNTER:06d}"
    MOCK_DATABASE_COUNTER += 1
    
    database = Database(
        id=db_id,
        name=name,
        createdAt=datetime.now()
    )
    
    MOCK_DATABASES[db_id] = database
    return database


@router.get(
    "/databases/{database_id}",
    response_model=Database,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="[MOCK] Get database metadata",
    description="Mock endpoint that returns fake database metadata.",
)
async def mock_get_database(database_id: str) -> Database:
    """
    Mock get database endpoint.
    Returns fake database metadata.
    """
    # Return stored mock database or create a new one
    if database_id in MOCK_DATABASES:
        return MOCK_DATABASES[database_id]
    
    return Database(
        id=database_id,
        name=f"Mock Database {database_id}",
        createdAt=datetime.now()
    )


@router.get(
    "/databases/{database_id}/schema",
    response_model=DatabaseSchema,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="[MOCK] Get database schema metadata",
    description="Mock endpoint that returns fake schema with 100 tables and columns.",
)
async def mock_get_database_schema(database_id: str) -> DatabaseSchema:
    """
    Mock database schema endpoint.
    Returns a large sample schema with 100 tables.
    """
    tables = []
    
    # Generate 100 tables with realistic column structures
    table_templates = [
        # User & Auth domain (10 tables)
        ("users", ["id", "username", "email", "password_hash", "created_at", "last_login"]),
        ("user_profiles", ["id", "user_id", "first_name", "last_name", "bio", "avatar_url"]),
        ("user_sessions", ["id", "user_id", "token", "ip_address", "created_at", "expires_at"]),
        ("user_roles", ["id", "user_id", "role_id", "assigned_at"]),
        ("roles", ["id", "name", "description", "permissions"]),
        ("permissions", ["id", "resource", "action", "description"]),
        ("user_settings", ["id", "user_id", "key", "value", "updated_at"]),
        ("user_notifications", ["id", "user_id", "message", "read", "created_at"]),
        ("user_activity_log", ["id", "user_id", "action", "resource", "timestamp"]),
        ("password_reset_tokens", ["id", "user_id", "token", "expires_at", "used"]),
        
        # Product domain (15 tables)
        ("products", ["id", "name", "sku", "description", "price", "stock_quantity"]),
        ("product_categories", ["id", "name", "parent_id", "description", "sort_order"]),
        ("product_category_mapping", ["product_id", "category_id"]),
        ("product_images", ["id", "product_id", "url", "alt_text", "sort_order"]),
        ("product_variants", ["id", "product_id", "name", "sku", "price", "stock"]),
        ("product_attributes", ["id", "product_id", "name", "value"]),
        ("product_reviews", ["id", "product_id", "user_id", "rating", "comment", "created_at"]),
        ("product_inventory", ["id", "product_id", "warehouse_id", "quantity", "updated_at"]),
        ("product_suppliers", ["id", "product_id", "supplier_id", "cost", "lead_time"]),
        ("product_tags", ["id", "product_id", "tag", "created_at"]),
        ("product_discounts", ["id", "product_id", "discount_percent", "start_date", "end_date"]),
        ("product_bundles", ["id", "name", "description", "price"]),
        ("product_bundle_items", ["bundle_id", "product_id", "quantity"]),
        ("product_specifications", ["id", "product_id", "spec_name", "spec_value"]),
        ("product_warranty", ["id", "product_id", "duration_months", "terms"]),
        
        # Order domain (12 tables)
        ("orders", ["id", "user_id", "order_date", "total_amount", "status", "shipping_address"]),
        ("order_items", ["id", "order_id", "product_id", "quantity", "price", "discount"]),
        ("order_status_history", ["id", "order_id", "status", "notes", "changed_at"]),
        ("order_payments", ["id", "order_id", "payment_method", "amount", "status", "processed_at"]),
        ("order_shipments", ["id", "order_id", "carrier", "tracking_number", "shipped_at"]),
        ("order_returns", ["id", "order_id", "reason", "status", "requested_at"]),
        ("order_return_items", ["id", "return_id", "order_item_id", "quantity", "refund_amount"]),
        ("order_invoices", ["id", "order_id", "invoice_number", "issued_at", "due_date"]),
        ("order_notes", ["id", "order_id", "user_id", "note", "created_at"]),
        ("shopping_carts", ["id", "user_id", "created_at", "updated_at"]),
        ("shopping_cart_items", ["id", "cart_id", "product_id", "quantity"]),
        ("wishlists", ["id", "user_id", "product_id", "added_at"]),
        
        # Inventory & Warehouse (8 tables)
        ("warehouses", ["id", "name", "address", "city", "country", "capacity"]),
        ("warehouse_zones", ["id", "warehouse_id", "name", "type"]),
        ("inventory_transactions", ["id", "product_id", "warehouse_id", "quantity", "type", "timestamp"]),
        ("stock_levels", ["id", "product_id", "warehouse_id", "quantity", "reserved", "available"]),
        ("stock_alerts", ["id", "product_id", "warehouse_id", "threshold", "triggered_at"]),
        ("inventory_audits", ["id", "warehouse_id", "auditor", "status", "scheduled_date"]),
        ("inventory_adjustments", ["id", "product_id", "warehouse_id", "quantity_change", "reason", "adjusted_at"]),
        ("bin_locations", ["id", "warehouse_id", "zone_id", "aisle", "rack", "shelf"]),
        
        # Shipping & Logistics (7 tables)
        ("shipping_methods", ["id", "name", "carrier", "estimated_days", "base_cost"]),
        ("shipping_zones", ["id", "name", "countries", "states"]),
        ("shipping_rates", ["id", "method_id", "zone_id", "weight_min", "weight_max", "cost"]),
        ("shipment_tracking", ["id", "shipment_id", "status", "location", "timestamp"]),
        ("delivery_attempts", ["id", "shipment_id", "attempt_date", "status", "notes"]),
        ("shipping_labels", ["id", "shipment_id", "label_url", "generated_at"]),
        ("customs_declarations", ["id", "shipment_id", "value", "description", "hs_code"]),
        
        # Customer Service (8 tables)
        ("support_tickets", ["id", "user_id", "subject", "status", "priority", "created_at"]),
        ("ticket_messages", ["id", "ticket_id", "user_id", "message", "is_internal", "created_at"]),
        ("ticket_attachments", ["id", "message_id", "filename", "url", "size"]),
        ("ticket_categories", ["id", "name", "description", "sla_hours"]),
        ("ticket_assignments", ["id", "ticket_id", "agent_id", "assigned_at"]),
        ("canned_responses", ["id", "title", "content", "category", "usage_count"]),
        ("customer_feedback", ["id", "user_id", "order_id", "rating", "comment", "created_at"]),
        ("live_chat_sessions", ["id", "user_id", "agent_id", "started_at", "ended_at"]),
        
        # Marketing & Promotions (10 tables)
        ("campaigns", ["id", "name", "type", "start_date", "end_date", "budget"]),
        ("campaign_emails", ["id", "campaign_id", "subject", "body", "sent_at"]),
        ("email_subscribers", ["id", "email", "subscribed", "source", "subscribed_at"]),
        ("promotional_codes", ["id", "code", "discount_type", "discount_value", "expires_at", "max_uses"]),
        ("code_redemptions", ["id", "code_id", "user_id", "order_id", "redeemed_at"]),
        ("loyalty_programs", ["id", "name", "points_per_dollar", "active"]),
        ("loyalty_points", ["id", "user_id", "points", "earned_from", "created_at"]),
        ("loyalty_rewards", ["id", "program_id", "name", "points_required", "description"]),
        ("referral_programs", ["id", "referrer_id", "referred_id", "bonus_amount", "status"]),
        ("marketing_analytics", ["id", "campaign_id", "impressions", "clicks", "conversions", "date"]),
        
        # Finance & Accounting (10 tables)
        ("transactions", ["id", "order_id", "type", "amount", "currency", "timestamp"]),
        ("payment_methods", ["id", "user_id", "type", "last_four", "expires", "is_default"]),
        ("refunds", ["id", "order_id", "amount", "reason", "status", "processed_at"]),
        ("invoices", ["id", "order_id", "invoice_number", "total", "tax", "issued_at"]),
        ("tax_rates", ["id", "country", "state", "rate", "effective_date"]),
        ("payment_gateways", ["id", "name", "type", "api_key", "is_active"]),
        ("revenue_reports", ["id", "period_start", "period_end", "total_revenue", "generated_at"]),
        ("expense_records", ["id", "category", "amount", "description", "date"]),
        ("budget_allocations", ["id", "department", "category", "allocated_amount", "fiscal_year"]),
        ("financial_statements", ["id", "statement_type", "period", "data", "created_at"]),
        
        # Analytics & Reporting (10 tables)
        ("page_views", ["id", "user_id", "page_url", "referrer", "timestamp"]),
        ("conversion_events", ["id", "user_id", "event_type", "value", "timestamp"]),
        ("ab_tests", ["id", "name", "variant_a", "variant_b", "start_date", "end_date"]),
        ("ab_test_results", ["id", "test_id", "variant", "impressions", "conversions"]),
        ("user_segments", ["id", "name", "criteria", "user_count", "created_at"]),
        ("cohort_analysis", ["id", "cohort_date", "retention_day", "users", "active_users"]),
        ("sales_metrics", ["id", "date", "revenue", "orders", "avg_order_value"]),
        ("product_performance", ["id", "product_id", "views", "purchases", "revenue", "date"]),
        ("customer_lifetime_value", ["id", "user_id", "total_spent", "order_count", "calculated_at"]),
        ("dashboard_widgets", ["id", "user_id", "widget_type", "config", "position"]),
        
        # Content Management (5 tables)
        ("pages", ["id", "title", "slug", "content", "published", "created_at"]),
        ("blog_posts", ["id", "author_id", "title", "content", "status", "published_at"]),
        ("post_comments", ["id", "post_id", "user_id", "comment", "approved", "created_at"]),
        ("media_library", ["id", "filename", "type", "size", "url", "uploaded_at"]),
        ("seo_metadata", ["id", "page_id", "title", "description", "keywords"]),
        
        # System & Configuration (5 tables)
        ("system_settings", ["id", "key", "value", "description", "updated_at"]),
        ("feature_flags", ["id", "name", "enabled", "rollout_percent", "updated_at"]),
        ("api_keys", ["id", "user_id", "key_hash", "name", "expires_at", "created_at"]),
        ("webhooks", ["id", "url", "events", "secret", "is_active"]),
        ("audit_logs", ["id", "user_id", "action", "resource_type", "resource_id", "timestamp"]),
    ]
    
    for idx, (table_name, columns) in enumerate(table_templates[:100]):
        column_metadata = []
        for col_idx, col_name in enumerate(columns):
            # Determine column properties
            is_pk = col_name == "id"
            is_fk = col_name.endswith("_id") and col_name != "id"
            
            data_type = "INTEGER"
            if "email" in col_name or "url" in col_name or "name" in col_name:
                data_type = "VARCHAR(255)"
            elif "description" in col_name or "content" in col_name or "message" in col_name:
                data_type = "TEXT"
            elif "price" in col_name or "amount" in col_name or "cost" in col_name:
                data_type = "DECIMAL(10,2)"
            elif "date" in col_name or "timestamp" in col_name or "_at" in col_name:
                data_type = "TIMESTAMP"
            elif "is_" in col_name or col_name in ["active", "enabled", "approved", "read", "used"]:
                data_type = "BOOLEAN"
            
            column_metadata.append(
                ColumnMetadata(
                    name=col_name,
                    dataType=data_type,
                    nullable=not is_pk,
                    isPrimaryKey=is_pk,
                    isForeignKey=is_fk,
                    foreignKeyReference=f"{col_name[:-3]}.id" if is_fk else None,
                )
            )
        
        tables.append(
            TableMetadata(
                schema="public",
                name=table_name,
                columnCount=len(columns),
                columns=column_metadata
            )
        )
    
    return DatabaseSchema(
        databaseId=database_id,
        tableCount=len(tables),
        tables=tables
    )


@router.delete(
    "/databases/{database_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="[MOCK] Delete database",
    description="Mock endpoint that removes a database from the mock storage.",
)
async def mock_delete_database(database_id: str) -> None:
    """
    Mock database deletion endpoint.
    Removes the database from mock storage.
    """
    if database_id not in MOCK_DATABASES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Database {database_id} not found"
        )
    
    del MOCK_DATABASES[database_id]


@router.post(
    "/databases/{database_id}/cluster",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="[MOCK] Start clustering job",
    description="Mock endpoint that simulates starting a clustering job and returns a job ID.",
)
async def mock_cluster_database(
    database_id: str,
    request: ClusterRequest = Body(default=ClusterRequest()),
) -> dict:
    """
    Mock clustering endpoint that starts a job.
    The job will complete after a few seconds when polled.
    """
    # Create a mock job
    job = job_manager.create_job(
        job_type=JobType.CLUSTERING,
        database_id=database_id,
        parameters={"apply_finetuning": request.apply_finetuning}
    )
    
    # Start a background task that simulates processing
    async def mock_clustering_task():
        """Simulate clustering with progress updates"""
        try:
            job_manager.update_progress(job.id, 0, 100, "Starting clustering analysis...")
            await asyncio.sleep(1)
            
            job_manager.update_progress(job.id, 25, 100, "Analyzing table relationships...")
            await asyncio.sleep(1)
            
            job_manager.update_progress(job.id, 50, 100, "Computing similarity scores...")
            await asyncio.sleep(1)
            
            job_manager.update_progress(job.id, 75, 100, "Clustering tables...")
            await asyncio.sleep(1)
            
            job_manager.update_progress(job.id, 90, 100, "Finalizing results...")
            await asyncio.sleep(0.5)
            
            # Generate the mock clustering result
            result = _generate_mock_clustering(database_id)
            return result
        except Exception as e:
            raise e
    
    # Start the job
    job_manager.start_job(job.id, mock_clustering_task)
    
    return {
        "jobId": job.id,
        "status": job.status.value,
        "message": "Clustering job started"
    }


def _generate_mock_clustering(database_id: str) -> ClusteringResult:
    """Generate mock clustering result with 35 clusters for 100 tables"""
    # Define 35 clusters with realistic distribution
    clusters = [
        ClusterInfo(
            cluster_id=1,
            name="User Management",
            description="User accounts, authentication, and authorization",
            tables=["users", "user_profiles", "user_sessions", "password_reset_tokens"],
            confidence=0.95
        ),
        ClusterInfo(
            cluster_id=2,
            name="Access Control",
            description="Roles, permissions, and user authorization",
            tables=["user_roles", "roles", "permissions"],
            confidence=0.93
        ),
        ClusterInfo(
            cluster_id=3,
            name="User Engagement",
            description="User settings, notifications, and activity tracking",
            tables=["user_settings", "user_notifications", "user_activity_log"],
            confidence=0.91
        ),
        ClusterInfo(
            cluster_id=4,
            name="Product Catalog",
            description="Core product information and categorization",
            tables=["products", "product_categories", "product_category_mapping", "product_tags"],
            confidence=0.94
        ),
        ClusterInfo(
            cluster_id=5,
            name="Product Media & Content",
            description="Product images, descriptions, and specifications",
            tables=["product_images", "product_variants", "product_attributes", "product_specifications"],
            confidence=0.89
        ),
        ClusterInfo(
            cluster_id=6,
            name="Product Reviews",
            description="Customer ratings and reviews",
            tables=["product_reviews"],
            confidence=0.88
        ),
        ClusterInfo(
            cluster_id=7,
            name="Product Inventory Management",
            description="Stock levels and warehouse inventory",
            tables=["product_inventory", "stock_levels"],
            confidence=0.92
        ),
        ClusterInfo(
            cluster_id=8,
            name="Product Sourcing",
            description="Supplier relationships and procurement",
            tables=["product_suppliers", "product_warranty"],
            confidence=0.87
        ),
        ClusterInfo(
            cluster_id=9,
            name="Product Promotions",
            description="Product discounts and bundle offers",
            tables=["product_discounts", "product_bundles", "product_bundle_items"],
            confidence=0.86
        ),
        ClusterInfo(
            cluster_id=10,
            name="Order Processing",
            description="Order creation and management",
            tables=["orders", "order_items", "order_status_history", "order_notes"],
            confidence=0.96
        ),
        ClusterInfo(
            cluster_id=11,
            name="Order Payments",
            description="Payment processing and invoicing",
            tables=["order_payments", "order_invoices"],
            confidence=0.94
        ),
        ClusterInfo(
            cluster_id=12,
            name="Order Fulfillment",
            description="Shipping and delivery management",
            tables=["order_shipments"],
            confidence=0.90
        ),
        ClusterInfo(
            cluster_id=13,
            name="Returns & Refunds",
            description="Return processing and refund management",
            tables=["order_returns", "order_return_items"],
            confidence=0.88
        ),
        ClusterInfo(
            cluster_id=14,
            name="Shopping Experience",
            description="Shopping carts and wishlists",
            tables=["shopping_carts", "shopping_cart_items", "wishlists"],
            confidence=0.92
        ),
        ClusterInfo(
            cluster_id=15,
            name="Warehouse Operations",
            description="Warehouse facilities and zones",
            tables=["warehouses", "warehouse_zones", "bin_locations"],
            confidence=0.93
        ),
        ClusterInfo(
            cluster_id=16,
            name="Inventory Tracking",
            description="Stock transactions and adjustments",
            tables=["inventory_transactions", "inventory_adjustments"],
            confidence=0.91
        ),
        ClusterInfo(
            cluster_id=17,
            name="Inventory Control",
            description="Stock alerts and audits",
            tables=["stock_alerts", "inventory_audits"],
            confidence=0.85
        ),
        ClusterInfo(
            cluster_id=18,
            name="Shipping Configuration",
            description="Shipping methods, zones, and rates",
            tables=["shipping_methods", "shipping_zones", "shipping_rates"],
            confidence=0.90
        ),
        ClusterInfo(
            cluster_id=19,
            name="Shipment Tracking",
            description="Package tracking and delivery",
            tables=["shipment_tracking", "delivery_attempts", "shipping_labels"],
            confidence=0.89
        ),
        ClusterInfo(
            cluster_id=20,
            name="International Shipping",
            description="Customs and international logistics",
            tables=["customs_declarations"],
            confidence=0.84
        ),
        ClusterInfo(
            cluster_id=21,
            name="Customer Support",
            description="Support ticket management",
            tables=["support_tickets", "ticket_messages", "ticket_attachments", "ticket_assignments"],
            confidence=0.93
        ),
        ClusterInfo(
            cluster_id=22,
            name="Support Operations",
            description="Support categories and canned responses",
            tables=["ticket_categories", "canned_responses"],
            confidence=0.87
        ),
        ClusterInfo(
            cluster_id=23,
            name="Customer Feedback",
            description="Ratings, reviews, and live chat",
            tables=["customer_feedback", "live_chat_sessions"],
            confidence=0.86
        ),
        ClusterInfo(
            cluster_id=24,
            name="Marketing Campaigns",
            description="Campaign management and email marketing",
            tables=["campaigns", "campaign_emails", "email_subscribers"],
            confidence=0.92
        ),
        ClusterInfo(
            cluster_id=25,
            name="Promotional Programs",
            description="Discount codes and promotions",
            tables=["promotional_codes", "code_redemptions"],
            confidence=0.90
        ),
        ClusterInfo(
            cluster_id=26,
            name="Loyalty Programs",
            description="Customer loyalty and rewards",
            tables=["loyalty_programs", "loyalty_points", "loyalty_rewards"],
            confidence=0.89
        ),
        ClusterInfo(
            cluster_id=27,
            name="Referral Marketing",
            description="Referral programs and tracking",
            tables=["referral_programs", "marketing_analytics"],
            confidence=0.83
        ),
        ClusterInfo(
            cluster_id=28,
            name="Payment Processing",
            description="Transactions and payment methods",
            tables=["transactions", "payment_methods", "payment_gateways"],
            confidence=0.95
        ),
        ClusterInfo(
            cluster_id=29,
            name="Financial Operations",
            description="Invoicing, refunds, and tax management",
            tables=["refunds", "invoices", "tax_rates"],
            confidence=0.91
        ),
        ClusterInfo(
            cluster_id=30,
            name="Financial Reporting",
            description="Revenue reports and financial statements",
            tables=["revenue_reports", "expense_records", "budget_allocations", "financial_statements"],
            confidence=0.88
        ),
        ClusterInfo(
            cluster_id=31,
            name="User Analytics",
            description="Page views and conversion tracking",
            tables=["page_views", "conversion_events", "user_segments"],
            confidence=0.90
        ),
        ClusterInfo(
            cluster_id=32,
            name="Experimentation",
            description="A/B testing and cohort analysis",
            tables=["ab_tests", "ab_test_results", "cohort_analysis"],
            confidence=0.85
        ),
        ClusterInfo(
            cluster_id=33,
            name="Business Intelligence",
            description="Sales metrics and performance dashboards",
            tables=["sales_metrics", "product_performance", "customer_lifetime_value", "dashboard_widgets"],
            confidence=0.87
        ),
        ClusterInfo(
            cluster_id=34,
            name="Content Management",
            description="Pages, blog posts, and media",
            tables=["pages", "blog_posts", "post_comments", "media_library", "seo_metadata"],
            confidence=0.89
        ),
        ClusterInfo(
            cluster_id=35,
            name="System Administration",
            description="Configuration, feature flags, and audit logs",
            tables=["system_settings", "feature_flags", "api_keys", "webhooks", "audit_logs"],
            confidence=0.92
        ),
    ]
    
    return ClusteringResult(
        database_id=database_id,
        clusters=clusters,
        created_at=datetime.now()
    )


@router.get(
    "/jobs/{job_id}",
    summary="[MOCK] Get job status",
    description="Mock endpoint that returns job status and results.",
)
async def mock_get_job_status(job_id: str) -> dict:
    """
    Mock job status endpoint.
    Returns the status of a mock job.
    """
    job = job_manager.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    return {
        "id": job.id,
        "type": job.type.value,
        "status": job.status.value,
        "progress": job.progress.dict() if job.progress else None,
        "result": job.result,
        "error": job.error
    }


@router.put(
    "/databases/{database_id}/cluster",
    response_model=dict,
    summary="[MOCK] Save updated clustering",
    description="Mock endpoint that simulates saving clustering changes.",
)
async def mock_save_clustering(
    database_id: str,
    clustering: ClusteringResult,
) -> dict:
    """
    Mock endpoint to save clustering changes.
    In a real implementation, this would persist the clustering to a database.
    """
    return {
        "success": True,
        "message": "Clustering saved successfully",
        "clustering": clustering
    }


# ===== CONCEPT ENDPOINTS =====

@router.post(
    "/databases/{database_id}/clusters/{cluster_id}/concepts",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="[MOCK] Generate concepts for a cluster",
    description="Mock endpoint that starts a job to generate concept suggestions for a cluster.",
)

async def mock_generate_concepts(
    database_id: str,
    cluster_id: int,
) -> JobCreateResponse:
    """
    Mock concept generation endpoint.
    Simulates generating concept suggestions with a background job.
    """
    # Get the database to access its schema
    if database_id not in MOCK_DATABASES:
        raise HTTPException(status_code=404, detail=f"Database {database_id} not found")
    
    # Create a job
    job = job_manager.create_job(
        job_type=JobType.CONCEPTS,
        database_id=database_id,
        parameters={"cluster_id": cluster_id}
    )
    
    # Start background task to simulate concept generation
    async def simulate_concept_generation():
        try:
            # Mark job as running
            job_obj = job_manager.get_job(job.id)
            if job_obj:
                job_obj.status = job_manager._jobs[job.id].status = JobStatus.RUNNING
                job_obj.updatedAt = datetime.now()
            
            # Get clustering result to know which tables are in this cluster
            await asyncio.sleep(0.2)
            job_manager.update_progress(job.id, 0, 5, "Fetching cluster information...")
            
            clustering_result = _generate_mock_clustering(database_id)
            cluster_info = None
            for cluster in clustering_result.clusters:
                if cluster.cluster_id == cluster_id:
                    cluster_info = cluster
                    break
            
            if not cluster_info:
                raise ValueError(f"Cluster {cluster_id} not found")
            
            await asyncio.sleep(0.2)
            job_manager.update_progress(job.id, 1, 5, "Analyzing table structures...")
            
            # Get schema to understand columns
            schema = await mock_get_database_schema(database_id)
            table_map = {table.name: table for table in schema.tables}
            
            await asyncio.sleep(0.2)
            job_manager.update_progress(job.id, 2, 5, "Identifying key attributes...")
            
            # Generate concepts - one concept per table in the cluster
            concepts = []
            for table_name in cluster_info.tables:
                if table_name not in table_map:
                    continue
                    
                table = table_map[table_name]
                
                # Find ID column(s) - typically "id" or columns ending with "_id"
                id_columns = [col for col in table.columns if col.name == "id"]
                if not id_columns:
                    # Look for primary key or first column as fallback
                    id_columns = [col for col in table.columns if col.is_primary_key]
                if not id_columns and table.columns:
                    id_columns = [table.columns[0]]
                
                # Get other descriptive columns (exclude foreign keys and technical columns)
                descriptive_cols = [
                    col for col in table.columns 
                    if col.name not in ["id", "created_at", "updated_at", "deleted_at"] 
                    and not col.is_foreign_key
                    and col not in id_columns
                ][:5]  # Limit to 5 attributes
                
                await asyncio.sleep(0.1)
                job_manager.update_progress(job.id, 3, 5, f"Generating concept for {table_name}...")
                
                # Create concept name from table name (capitalize and singularize roughly)
                concept_name = table_name.replace("_", " ").title().rstrip("s")
                
                # Add sub-concepts for the first table with foreign keys
                sub_concepts = []
                if len(concepts) == 0 and any(col.is_foreign_key for col in table.columns):
                    # Create a sub-concept for details/history
                    fk_columns = [col for col in table.columns if col.is_foreign_key]
                    if fk_columns:
                        fk_col = fk_columns[0]
                        ref_parts = fk_col.foreign_key_reference.split('.') if fk_col.foreign_key_reference else []
                        if len(ref_parts) == 2:
                            ref_table = ref_parts[0]
                            sub_concepts.append(Concept(
                                id=f"concept_{cluster_id}_{table_name}_details",
                                name=f"{concept_name} Details",
                                clusterId=cluster_id,
                                idAttributes=[
                                    ConceptIDAttribute(
                                        attributes=[
                                            ConceptAttribute(table=ref_table, column="id"),
                                            ConceptAttribute(table=table_name, column="id")
                                        ]
                                    )
                                ],
                                attributes=[
                                    ConceptAttribute(table=table_name, column=col.name)
                                    for col in descriptive_cols[:3]
                                ],
                                confidence=0.82
                            ))
                
                # Add conditions and joins for the first concept
                conditions = None
                joins = None
                if len(concepts) == 0:
                    conditions = [
                        ConceptCondition(
                            table=table_name,
                            column="status",
                            operator="=",
                            value="active"
                        ),
                        ConceptCondition(
                            table=table_name,
                            column="deleted_at",
                            operator="IS",
                            value="NULL"
                        )
                    ]
                    # Find a related table for join
                    fk_columns = [col for col in table.columns if col.is_foreign_key]
                    if fk_columns:
                        fk_col = fk_columns[0]
                        ref_parts = fk_col.foreign_key_reference.split('.') if fk_col.foreign_key_reference else []
                        if len(ref_parts) == 2:
                            ref_table = ref_parts[0]
                            joins = [f"LEFT JOIN {ref_table} ON {table_name}.{fk_col.name} = {ref_table}.id"]
                
                concept = Concept(
                    id=f"concept_{cluster_id}_{table_name}",
                    name=concept_name,
                    clusterId=cluster_id,
                    idAttributes=[
                        ConceptIDAttribute(
                            attributes=[
                                ConceptAttribute(table=table_name, column=col.name)
                                for col in id_columns
                            ]
                        )
                    ],
                    attributes=[
                        ConceptAttribute(table=table_name, column=col.name)
                        for col in descriptive_cols
                    ],
                    confidence=round(0.75 + (hash(table_name) % 20) / 100, 2),  # 0.75-0.95
                    subConcepts=sub_concepts if sub_concepts else None,
                    conditions=conditions,
                    joins=joins
                )
                concepts.append(concept)
            
            await asyncio.sleep(0.2)
            job_manager.update_progress(job.id, 4, 5, "Finalizing concepts...")
            
            result = ConceptSuggestion(concepts=concepts)
            
            await asyncio.sleep(0.1)
            job_manager.update_progress(job.id, 5, 5, "Complete!")
            
            # Complete the job
            job_manager.complete_job(job.id, result.dict())
        except Exception as e:
            job_manager.fail_job(job.id, str(e))
    
    # Start the background task
    asyncio.create_task(simulate_concept_generation())
    
    return JobCreateResponse(jobId=job.id)


@router.post(
    "/databases/{database_id}/clusters/{cluster_id}/concepts/save",
    response_model=dict,
    summary="[MOCK] Save confirmed concepts",
    description="Mock endpoint that saves confirmed concepts for a cluster.",
)
async def mock_save_concepts(
    database_id: str,
    cluster_id: int,
    concepts: ConceptSuggestion,
) -> dict:
    """
    Mock endpoint to save confirmed concepts.
    In a real implementation, this would persist concepts to a database.
    """
    return {
        "message": f"Saved {len(concepts.concepts)} concept(s) for cluster {cluster_id}",
        "clusterid": cluster_id,
        "conceptCount": len(concepts.concepts)
    }


@router.get(
    "/databases/{database_id}/concepts",
    response_model=ConceptSuggestion,
    summary="[MOCK] Get all confirmed concepts",
    description="Mock endpoint that returns all confirmed concepts for a database.",
)
async def mock_get_all_concepts(database_id: str) -> ConceptSuggestion:
    """
    Mock endpoint to get all confirmed concepts.
    Returns empty list for now.
    """
    return ConceptSuggestion(concepts=[])


# ===== ATTRIBUTES ENDPOINTS =====

@router.post(
    "/databases/{database_id}/concepts/{concept_id}/attributes",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="[MOCK] Generate attributes for a concept",
    description="Mock endpoint that starts a job to generate attribute suggestions for a concept.",
)
async def mock_generate_attributes(
    database_id: str,
    concept_id: str,
) -> JobCreateResponse:
    """
    Mock attribute generation endpoint.
    Simulates generating attribute suggestions with a background job.
    """
    # Create a job
    job = job_manager.create_job(
        job_type=JobType.CONCEPTS,  # Reuse CONCEPTS type or add ATTRIBUTES type
        database_id=database_id,
        parameters={"concept_id": concept_id}
    )
    
    # Start background task to simulate attribute generation
    async def simulate_attribute_generation():
        try:
            await asyncio.sleep(0.2)
            job_manager.update_progress(job.id, 1, 3, "Analyzing concept structure...")
            
            # Generate mock attributes
            mock_attributes = [
                {
                    "id": f"attr_{concept_id}_1",
                    "name": "Name",
                    "column": "name",
                    "table": "main_table",
                    "dataType": "VARCHAR",
                    "isRequired": True
                },
                {
                    "id": f"attr_{concept_id}_2",
                    "name": "Description",
                    "column": "description",
                    "table": "main_table",
                    "dataType": "TEXT",
                    "isRequired": False
                },
                {
                    "id": f"attr_{concept_id}_3",
                    "name": "Created At",
                    "column": "created_at",
                    "table": "main_table",
                    "dataType": "TIMESTAMP",
                    "isRequired": True
                }
            ]
            
            await asyncio.sleep(0.2)
            job_manager.update_progress(job.id, 2, 3, "Generating attributes...")
            
            result = {"attributes": mock_attributes}
            
            await asyncio.sleep(0.1)
            job_manager.update_progress(job.id, 3, 3, "Complete!")
            
            job_manager.complete_job(job.id, result)
        except Exception as e:
            job_manager.fail_job(job.id, str(e))
    
    asyncio.create_task(simulate_attribute_generation())
    
    return JobCreateResponse(jobId=job.id)


@router.post(
    "/databases/{database_id}/concepts/{concept_id}/attributes/save",
    response_model=dict,
    summary="[MOCK] Save confirmed attributes",
    description="Mock endpoint that saves confirmed attributes for a concept.",
)
async def mock_save_attributes(
    database_id: str,
    concept_id: str,
    attributes: dict,
) -> dict:
    """
    Mock endpoint to save confirmed attributes.
    """
    return {
        "message": f"Saved attributes for concept {concept_id}",
        "conceptId": concept_id,
        "attributeCount": len(attributes.get("attributes", []))
    }


# ===== RELATIONSHIPS ENDPOINTS =====

@router.get(
    "/databases/{database_id}/relationships/suggest",
    response_model=list[Relationship],
    summary="[MOCK] Suggest relationships between concepts",
    description="Mock endpoint that returns relationship suggestions with confidence scores.",
)
async def mock_suggest_relationships(database_id: str) -> list[Relationship]:
    """
    Mock endpoint that generates sample relationships between concepts.
    Returns a few example relationships with confidence scores.
    """
    # Simulate some delay for API call
    await asyncio.sleep(1.5)
    
    # Generate mock relationships
    # In a real implementation, this would analyze the confirmed concepts
    # and suggest relationships based on foreign keys, naming patterns, etc.
    
    mock_relationships = [
        # High confidence (>= 0.9) - Green
        Relationship(
            id="rel_1",
            fromConceptId="concept_1_users",
            toConceptId="concept_10_orders",
            name="places",
            confidence=0.95
        ),
        Relationship(
            id="rel_2",
            fromConceptId="concept_10_orders",
            toConceptId="concept_4_products",
            name="contains",
            confidence=0.92
        ),
        # Good confidence (0.75-0.89) - Blue
        Relationship(
            id="rel_3",
            fromConceptId="concept_1_users",
            toConceptId="concept_6_product_reviews",
            name="writes",
            confidence=0.88
        ),
        Relationship(
            id="rel_4",
            fromConceptId="concept_4_products",
            toConceptId="concept_2_product_categories",
            name="belongs_to",
            confidence=0.82
        ),
        Relationship(
            id="rel_5",
            fromConceptId="concept_15_warehouses",
            toConceptId="concept_7_product_inventory_management",
            name="stores",
            confidence=0.77
        ),
        # Medium confidence (0.6-0.74) - Amber/Orange
        Relationship(
            id="rel_6",
            fromConceptId="concept_4_products",
            toConceptId="concept_15_warehouses",
            name="stored_in",
            confidence=0.68
        ),
        Relationship(
            id="rel_7",
            fromConceptId="concept_2_product_categories",
            toConceptId="concept_4_products",
            name="contains",
            confidence=0.72
        ),
        # Low confidence (< 0.6) - Red
        Relationship(
            id="rel_8",
            fromConceptId="concept_6_product_reviews",
            toConceptId="concept_4_products",
            name="reviews",
            confidence=0.55
        ),
        Relationship(
            id="rel_9",
            fromConceptId="concept_7_product_inventory_management",
            toConceptId="concept_4_products",
            name="tracks",
            confidence=0.48
        ),
    ]
    
    return mock_relationships


@router.post(
    "/databases/{database_id}/relationships/confirm",
    response_model=dict,
    summary="[MOCK] Confirm relationships",
    description="Mock endpoint that simulates confirming relationships.",
)
async def mock_confirm_relationships(
    database_id: str,
    request: RelationshipConfirmRequest,
) -> dict:
    """
    Mock endpoint to confirm and save relationships.
    In a real implementation, this would persist relationships to a database.
    """
    return {
        "message": f"Confirmed {len(request.relationships)} relationship(s)",
        "databaseId": database_id,
        "relationshipCount": len(request.relationships)
    }
