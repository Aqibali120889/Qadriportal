"""
app/schemas/kanban_task.py
─────────────────────────────────────────────────────────────────────────────
Phase 10 — Pydantic v2 schemas for the Kanban task management system.

Request bodies, response shapes, and pagination containers for:
  - KanbanTask CRUD
  - TaskComment operations
  - Task status moves (DnD)
  - Task assignment
  - History entries
  - Board grouping (for the Kanban view)
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Shared nested objects ─────────────────────────────────────────────────────

class UserSlim(BaseModel):
    id: str
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    email:      Optional[str] = None

    @property
    def display_name(self) -> str:
        parts = [self.first_name or "", self.last_name or ""]
        return " ".join(p for p in parts if p).strip() or self.email or "Unknown"

    model_config = {"from_attributes": True}


# ── Task schemas ──────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    project_id:      str
    department_id:   Optional[str] = None
    department_code: Optional[str] = None
    title:           str          = Field(..., min_length=1, max_length=500)
    description:     Optional[str] = None
    task_type:       Optional[str] = None
    priority:        str          = Field("medium", pattern="^(critical|high|medium|low)$")
    assigned_to:     Optional[str] = None
    due_date:        Optional[date] = None
    estimated_hours: Optional[Decimal] = None


class TaskUpdate(BaseModel):
    title:           Optional[str]     = Field(None, min_length=1, max_length=500)
    description:     Optional[str]     = None
    task_type:       Optional[str]     = None
    priority:        Optional[str]     = Field(None, pattern="^(critical|high|medium|low)$")
    assigned_to:     Optional[str]     = None
    due_date:        Optional[date]    = None
    estimated_hours: Optional[Decimal] = None


class StatusUpdateRequest(BaseModel):
    status:     str = Field(..., pattern="^(todo|in_progress|waiting_review|blocked|completed|cancelled)$")
    sort_order: Optional[int] = None


class AssignRequest(BaseModel):
    assigned_to: Optional[str]  # None = unassign


class TaskOut(BaseModel):
    id:              str
    project_id:      str
    department_id:   str
    title:           str
    description:     Optional[str]
    task_type:       Optional[str]
    status:          str
    priority:        str
    sort_order:      int
    assigned_to:     Optional[str]
    assigned_by:     Optional[str]
    created_by:      Optional[str]
    due_date:        Optional[date]
    estimated_hours: Optional[Decimal]
    completed_at:    Optional[datetime]
    is_ai_generated: bool
    created_at:      datetime
    updated_at:      datetime

    # Enriched fields (joined from users / projects)
    rfq_number:      Optional[str] = None
    project_title:   Optional[str] = None
    assignee_name:   Optional[str] = None
    assignee_email:  Optional[str] = None
    creator_name:    Optional[str] = None
    comments_count:  int = 0

    model_config = {"from_attributes": True}


class TaskListItem(BaseModel):
    """Lighter shape used in list/board views (no full comments/history)."""
    id:              str
    project_id:      str
    department_id:   str
    title:           str
    task_type:       Optional[str]
    status:          str
    priority:        str
    sort_order:      int
    assigned_to:     Optional[str]
    due_date:        Optional[date]
    is_ai_generated: bool
    created_at:      datetime
    updated_at:      datetime

    rfq_number:      Optional[str] = None
    project_title:   Optional[str] = None
    assignee_name:   Optional[str] = None
    comments_count:  int = 0

    model_config = {"from_attributes": True}


# ── Comment schemas ───────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class CommentOut(BaseModel):
    id:            str
    task_id:       str
    user_id:       Optional[str]
    department_id: Optional[str]
    content:       str
    created_at:    datetime
    updated_at:    datetime

    # Enriched
    author_name:  Optional[str] = None
    author_email: Optional[str] = None

    model_config = {"from_attributes": True}


# ── History schemas ───────────────────────────────────────────────────────────

class TaskHistoryEntry(BaseModel):
    id:         str
    task_id:    str
    user_id:    Optional[str]
    event_type: str
    old_value:  Optional[str]
    new_value:  Optional[str]
    metadata:   Optional[Dict[str, Any]] = None
    created_at: datetime

    # Enriched
    actor_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Board / list schemas ──────────────────────────────────────────────────────

class KanbanColumn(BaseModel):
    status: str
    tasks:  List[TaskListItem]
    count:  int


class BoardResponse(BaseModel):
    """Grouped-by-status response for the Kanban view."""
    columns:  List[KanbanColumn]
    total:    int
    dept_id:  Optional[str] = None


class PaginatedTaskList(BaseModel):
    items:       List[TaskListItem]
    total:       int
    page:        int
    page_size:   int
    has_more:    bool


# ── Task detail (full — with comments + history) ──────────────────────────────

class TaskDetailResponse(BaseModel):
    task:     TaskOut
    comments: List[CommentOut]
    history:  List[TaskHistoryEntry]
