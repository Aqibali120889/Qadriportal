"""
app/schemas/notification.py
─────────────────────────────────────────────────────────────────────────────
Pydantic schemas for the Notification Center (Bell dropdown + SSE stream).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.common import BaseSchema


class NotificationResponse(BaseSchema):
    """Single notification row, as returned by the list/stream endpoints."""
    id: str
    project_id: Optional[str] = None
    rfq_number: Optional[str] = None   # joined from projects.rfq_number, not stored
    department_id: Optional[str] = None
    user_id: Optional[str] = None
    event_type: Optional[str] = None
    notification_type: str              # INFO | SUCCESS | WARNING | ERROR | TASK
    title: str
    message: Optional[str] = None
    route: Optional[str] = None
    is_read: bool
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    read_at: Optional[datetime] = None


class PaginatedNotifications(BaseSchema):
    """Paginated response for GET /notifications."""
    items: List[NotificationResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


class UnreadCountResponse(BaseSchema):
    unread_count: int


class MarkReadResponse(BaseSchema):
    id: str
    is_read: bool
    read_at: Optional[datetime] = None
