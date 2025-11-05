"""Mock API endpoints for testing without backend logic implementation."""

from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, File, Form, UploadFile, status, Body

from app.models.database import Database, DatabaseSchema, ColumnMetadata, TableMetadata
from app.models.clustering import (
    ClusteringSuggestions,
    ClusteringGroup,
    ClusterRequest,
    ClusteringResult,
    ClusterInfo,
)
from app.models.common import ErrorResponse, TableRef

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


@router.post(
    "/databases/{database_id}/cluster",
    response_model=ClusteringResult,
    responses={
        404: {"model": ErrorResponse, "description": "Database not found"},
    },
    summary="[MOCK] Suggest clusters (groups of tables)",
    description="Mock endpoint that returns fake clustering suggestions with 35 clusters for 100 tables.",
)
async def mock_cluster_database(
    database_id: str,
    request: ClusterRequest = Body(default=ClusterRequest()),
) -> ClusteringResult:
    """
    Mock clustering endpoint.
    Returns sample clustering with 35 clusters distributed across 100 tables.
    """
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
