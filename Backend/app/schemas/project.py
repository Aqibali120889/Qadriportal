"""
app/schemas/project.py
─────────────────────────────────────────────────────────────────────────────
Pydantic v2 response schemas for the Projects API endpoints.

The GET /projects/{project_id} response is fully self-contained:
  - Project fields
  - Email subject & body
  - Drawing info + storage path (for signed URL generation)
  - Attachment metadata

The frontend renders all of this without making additional API calls.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema


# ── File / Drawing Schemas ────────────────────────────────────────────────────

class FileSchema(BaseSchema):
    id: str
    original_name: Optional[str]
    mime_type: Optional[str]
    file_size: Optional[int]
    storage_path: Optional[str]
    storage_provider: Optional[str]
    status: str
    current_version: int
    created_at: datetime


class DrawingSchema(BaseSchema):
    id: str
    drawing_title: Optional[str]
    drawing_number: Optional[str]
    revision: Optional[str]
    total_pages: Optional[int]
    file: Optional[FileSchema] = None
    # Signed URL is injected by the service layer — not stored in DB
    signed_url: Optional[str] = Field(default=None)
    created_at: datetime


# ── Email Schemas ─────────────────────────────────────────────────────────────

class AttachmentSchema(BaseSchema):
    id: str
    attachment_name: Optional[str]
    attachment_size: Optional[int]
    file: Optional[FileSchema] = None


class EmailSchema(BaseSchema):
    id: str
    subject: Optional[str]
    body: Optional[str]
    body_preview: Optional[str]
    sender_email: Optional[str]
    received_at: Optional[datetime]
    attachments: List[AttachmentSchema] = Field(default_factory=list)


# ── Project Response Schemas ──────────────────────────────────────────────────

class ProjectListItem(BaseSchema):
    """Lightweight schema for the paginated project list."""
    id: str
    job_number: str
    title: Optional[str]
    status: str
    priority: Optional[str]
    sender_email: Optional[str] = None
    attachment_count: int = 0
    created_at: datetime
    updated_at: datetime


class PaginatedProjectList(BaseSchema):
    """Paginated envelope for the GET /projects list endpoint."""
    items: List["ProjectListItem"]
    total: int
    page: int
    page_size: int
    has_next: bool


class ProjectDetailResponse(BaseSchema):
    """
    Full project detail returned by GET /projects/{project_id}.
    Includes email content, drawing info, and attachment metadata.
    The frontend can render the complete project view from this single response.
    """
    id: str
    job_number: str
    title: Optional[str]
    status: str
    priority: Optional[str]
    current_department_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Email information
    email: Optional[EmailSchema] = None

    # Drawing information (includes signed URL)
    drawing: Optional[DrawingSchema] = None

    # All file attachments
    files: List[FileSchema] = Field(default_factory=list)


# ── Phase 3: Dashboard Stats ──────────────────────────────────────────────────

class DepartmentStatsResponse(BaseSchema):
    """KPI counters for the department dashboard."""
    department_id: str
    department_name: str
    department_code: str
    total: int
    draft: int       # DRAFT → Kanban column: pending
    active: int      # ACTIVE → Kanban column: in-progress
    on_hold: int     # ON_HOLD → Kanban column: review
    completed: int   # COMPLETED → Kanban column: completed
    cancelled: int


# ── Phase 3: Kanban Board ─────────────────────────────────────────────────────

# Maps DB project status → frontend Kanban column id
KANBAN_COLUMN_MAP: dict = {
    "DRAFT":     "pending",
    "ACTIVE":    "in-progress",
    "ON_HOLD":   "review",
    "COMPLETED": "completed",
    "CANCELLED": "completed",
}


class KanbanTaskItem(BaseSchema):
    """Lightweight project row shaped as a Kanban card."""
    id: str
    job_number: str
    rfq_number: Optional[str] = None   # business identifier — same as job_number in the new flow
    title: Optional[str]
    status: str                        # DB status (DRAFT, ACTIVE, …)
    kanban_column: str                 # mapped column id for the board
    priority: Optional[str]
    sender_email: Optional[str] = None
    attachment_count: int = 0
    estimated_completion: Optional[str] = None   # ISO date string
    created_at: datetime
    updated_at: datetime
    # Derived at read time — not stored columns. See project_query_service.get_kanban_board.
    drawing_number: Optional[str] = None
    drawing_status: str = "NONE"       # NONE | RECEIVED
    ai_status: str = "NONE"            # NONE | QUEUED | PROCESSING | COMPLETED | FAILED
    has_excel_session: bool = False


class KanbanBoardResponse(BaseSchema):
    """All kanban tasks for the department, grouped by column."""
    department_id: str
    department_code: str
    tasks: List[KanbanTaskItem]
    # Column order for the board (fixed)
    columns: List[str] = Field(
        default_factory=lambda: ["pending", "in-progress", "review", "completed"]
    )


# ── Phase 3: Status Update ────────────────────────────────────────────────────

class ProjectStatusUpdate(BaseSchema):
    """Request body for PATCH /projects/{id}/status (Kanban drag-and-drop)."""
    status: str   # One of: DRAFT | ACTIVE | ON_HOLD | COMPLETED | CANCELLED
