"""
app/schemas/history.py
─────────────────────────────────────────────────────────────────────────────
Pydantic schemas for the department-scoped history / activity feed.

Sources merged into the feed:
  1. notifications table (department_id-scoped)  — workflow events, AI events
  2. projects table (created/updated records)     — project lifecycle events
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from app.schemas.common import BaseSchema


class HistoryItemResponse(BaseSchema):
    """Single activity-feed entry returned by GET /history."""
    id: str
    # "notification" | "project_created" | "project_updated"
    event_type: str
    title: str
    message: Optional[str] = None
    # Related project, if available
    project_id: Optional[str] = None
    job_number: Optional[str] = None
    # Severity / visual tag
    notification_type: Optional[str] = None   # INFO | SUCCESS | WARNING | ERROR | TASK
    # For project events: the new status
    status: Optional[str] = None
    created_at: datetime


class PaginatedHistory(BaseSchema):
    """Paginated history response."""
    items: List[HistoryItemResponse]
    total: int
    page: int
    page_size: int
    has_next: bool
