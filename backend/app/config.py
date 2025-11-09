"""Application configuration management."""

import json
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    log_level: str = "info"
    
    # Debug mode
    DEBUG: bool = False

    # Application Configuration
    app_name: str = "Ontology Learning API"
    app_version: str = "1.3.1"
    app_description: str = (
        "Endpoints compatible with Hamilton parsers (parse_concept, parse_mapping). "
        "Sampling behavior: samples=1 → single result form, samples>1 → probabilistic lists."
    )
    
    # Database Configuration
    METADATA_DATABASE_URL: str = "sqlite:///./hamilton_metadata.db"
    
    # PostgreSQL Admin Configuration (for creating new databases)
    POSTGRES_ADMIN_HOST: str = "localhost"
    POSTGRES_ADMIN_PORT: int = 5432
    POSTGRES_ADMIN_USER: str = "postgres"
    POSTGRES_ADMIN_PASSWORD: str = "postgres"
    POSTGRES_ADMIN_DATABASE: str = "postgres"
    
    # Model Configuration - LoRA Adapter Paths
    CONCEPT_ADAPTER_PATH: str = "/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_concepts_20251019163410/best"
    NAMING_ADAPTER_PATH: str = "/home/lukas/hamilton/seq2seq-polynomial/models/qwen_lora_concepts_20251019163410/best"  # Update if you have a separate naming adapter

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]
    cors_credentials: bool = True
    cors_methods: List[str] = ["*"]
    cors_headers: List[str] = ["*"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from JSON string or list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [v]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Global settings instance
settings = Settings()
