# Ontology Learning API - Python Backend

A high-quality, maintainable Python web server framework for the Ontology Learning API.

## Features

- **FastAPI** framework for high performance and automatic OpenAPI documentation
- **Pydantic v2** for robust data validation and serialization
- **Modular architecture** with clear separation of concerns
- **Type hints** throughout for better IDE support and maintainability
- **Dependency injection** for testability
- **Structured logging** for production debugging
- **Error handling** with custom exceptions
- **CORS support** for frontend integration

## Project Structure

```
python/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Application entry point
│   ├── config.py               # Configuration management
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependency injection
│   │   └── routes/             # API route handlers
│   │       ├── __init__.py
│   │       ├── databases.py
│   │       ├── clustering.py
│   │       └── ontology.py
│   ├── models/                 # Pydantic models (schemas)
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── clustering.py
│   │   ├── ontology.py
│   │   └── common.py
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── database_service.py
│   │   ├── clustering_service.py
│   │   └── ontology_service.py
│   └── core/                   # Core utilities
│       ├── __init__.py
│       ├── exceptions.py       # Custom exceptions
│       └── logging.py          # Logging configuration
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the server:**
   ```bash
   # Development mode with auto-reload
   python -m app.main
   
   # Or use uvicorn directly
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Documentation

Once the server is running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

## Development

### Adding New Endpoints

1. Define Pydantic models in `app/models/`
2. Create service methods in `app/services/`
3. Add route handlers in `app/api/routes/`
4. Register routes in `app/api/routes/__init__.py`

### Error Handling

Use custom exceptions from `app/core/exceptions.py`:
```python
from app.core.exceptions import NotFoundError, ValidationError

raise NotFoundError(f"Database {database_id} not found")
```

### Logging

```python
from app.core.logging import get_logger

logger = get_logger(__name__)
logger.info("Processing request", extra={"database_id": db_id})
```

## Testing

```bash
# Install testing dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## Production Deployment

```bash
# Install gunicorn for production
pip install gunicorn

# Run with gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```
