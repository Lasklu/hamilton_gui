"""Custom exception classes for the application."""

from typing import Any, Dict, Optional


class AppException(Exception):
    """Base exception class for application errors."""

    def __init__(
        self,
        message: str,
        error_code: str = "AppError",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(AppException):
    """Exception raised when a resource is not found."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="NotFoundError",
            status_code=404,
            details=details,
        )


class ValidationError(AppException):
    """Exception raised when validation fails."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="ValidationError",
            status_code=400,
            details=details,
        )


class DatabaseError(AppException):
    """Exception raised for database-related errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="DatabaseError",
            status_code=500,
            details=details,
        )


class ProcessingError(AppException):
    """Exception raised when processing fails."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="ProcessingError",
            status_code=500,
            details=details,
        )
