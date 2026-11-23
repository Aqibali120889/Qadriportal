"""
app/schemas/common.py
─────────────────────────────────────────────────────────────────────────────
Reusable Pydantic v2 base types and pagination wrappers shared across all schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class BaseSchema(BaseModel):
    """
    Project-wide Pydantic base.
    - orm_mode enabled (from_orm / model_validate works on SQLAlchemy models)
    - populate_by_name=True allows alias access via field name too
    """
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class PaginatedResponse(BaseSchema, Generic[T]):
    """Generic wrapper for list endpoints with pagination metadata."""
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool


class ErrorDetail(BaseSchema):
    """Structured error response body."""
    code: str
    message: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SuccessResponse(BaseSchema):
    """Generic success acknowledgement."""
    success: bool = True
    message: str
