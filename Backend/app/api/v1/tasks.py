"""
app/api/v1/tasks.py
─────────────────────────────────────────────────────────────────────────────
Phase 10 — REST endpoints for the Kanban & Task Management system.

All routes under /api/v1/tasks/...

IMPORTANT: FastAPI matches routes in declaration order.
Static/prefixed routes (/board, /meta/users, /project/{id}) MUST be declared
BEFORE the generic dynamic route (/{task_id}) or they will be silently
captured by the dynamic route and return 404/422.

Department isolation is enforced in task_service — routers only validate
shapes and wire dependencies.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.schemas.kanban_task import (
    AssignRequest,
    BoardResponse,
    CommentCreate,
    CommentOut,
    StatusUpdateRequest,
    TaskCreate,
    TaskDetailResponse,
    TaskHistoryEntry,
    TaskOut,
    TaskUpdate,
)
from app.services import task_service

logger = get_logger(__name__)

router = APIRouter(prefix="/tasks", tags=["Kanban Tasks"])


# ── Board ─────────────────────────────────────────────────────────────────────
# MUST be before /{task_id}

@router.get(
    "/board",
    response_model=BoardResponse,
    summary="Get Kanban board grouped by status",
    description=(
        "Returns all tasks grouped by status column. "
        "Normal users see only their department. Super Admins can pass ?department_id= "
        "to view a specific department or omit it to see all."
    ),
)
async def get_board(
    project_id:      Optional[str] = Query(default=None, description="Filter to a single project/RFQ"),
    department_id:   Optional[str] = Query(default=None, description="Super Admin only: target department"),
    assigned_to:     Optional[str] = Query(default=None, description="Filter by assignee user_id"),
    status:          Optional[str] = Query(default=None, description="Filter to one status column"),
    priority:        Optional[str] = Query(default=None, description="Filter by priority"),
    search:          Optional[str] = Query(default=None, description="Search title/description"),
    my_tasks:        bool          = Query(default=False, description="Only tasks assigned to me"),
    include_cancelled: bool        = Query(default=False, description="Include cancelled tasks"),
    ctx: RequestContext            = Depends(get_request_context),
    db: AsyncSession               = Depends(get_db),
) -> BoardResponse:
    return await task_service.get_board(
        ctx, db,
        project_id=project_id,
        department_id=department_id,
        assigned_to=assigned_to,
        status_filter=status,
        priority_filter=priority,
        search=search,
        my_tasks=my_tasks,
        include_cancelled=include_cancelled,
    )


# ── Users (for assignment dropdown) ──────────────────────────────────────────
# MUST be before /{task_id}

@router.get(
    "/meta/users",
    summary="Get users available for task assignment in this department",
)
async def get_assignable_users(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
):
    return await task_service.get_dept_users(ctx, db)


# ── Project list (for RFQ dropdown in Create task modal) ─────────────────────
# MUST be before /{task_id}

@router.get(
    "/meta/projects",
    summary="Get projects available for task creation in this department",
    description=(
        "Returns projects scoped to the caller's department. "
        "Super Admins receive all projects. "
        "Used to populate the RFQ selector in the Create Task modal."
    ),
)
async def get_kanban_projects(
    search: Optional[str] = Query(default=None, description="Search by rfq_number / title"),
    limit:  int           = Query(default=200, ge=1, le=500),
    ctx: RequestContext   = Depends(get_request_context),
    db: AsyncSession      = Depends(get_db),
):
    return await task_service.get_projects_for_kanban(ctx, db, search=search, limit=limit)


# ── Project-scoped list ───────────────────────────────────────────────────────
# MUST be before /{task_id}

@router.get(
    "/project/{project_id}",
    response_model=BoardResponse,
    summary="Get all tasks for a specific project/RFQ",
)
async def get_project_tasks(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> BoardResponse:
    return await task_service.get_board(ctx, db, project_id=project_id)


# ── Task CRUD ─────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
)
async def create_task(
    body: TaskCreate,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> TaskOut:
    return await task_service.create_task(body, ctx, db)


# ── Dynamic task routes — MUST be last (after all static paths) ──────────────

@router.get(
    "/{task_id}",
    response_model=TaskDetailResponse,
    summary="Get full task detail with comments + history",
)
async def get_task(
    task_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> TaskDetailResponse:
    return await task_service.get_task(task_id, ctx, db)


@router.patch(
    "/{task_id}",
    response_model=TaskOut,
    summary="Update task fields (title, description, priority, due date, etc.)",
)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> TaskOut:
    return await task_service.update_task(task_id, body, ctx, db)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_200_OK,
    summary="Cancel a task (soft-delete via status=cancelled)",
)
async def cancel_task(
    task_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> dict:
    await task_service.cancel_task(task_id, ctx, db)
    return {"cancelled": True, "task_id": task_id}


# ── Status (DnD) ──────────────────────────────────────────────────────────────

@router.patch(
    "/{task_id}/status",
    response_model=TaskOut,
    summary="Move task to a new status (drag-and-drop endpoint)",
    description=(
        "Updates status, writes task_history entry, fires notification, "
        "and broadcasts to SSE subscribers for the department. "
        "Designed for optimistic-update DnD: the frontend updates locally, "
        "then calls this to persist."
    ),
)
async def move_status(
    task_id: str,
    body: StatusUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> TaskOut:
    return await task_service.move_status(task_id, body, ctx, db)


# ── Assignment ────────────────────────────────────────────────────────────────

@router.post(
    "/{task_id}/assign",
    response_model=TaskOut,
    summary="Assign or unassign a task",
    description="Pass assigned_to=null to unassign.",
)
async def assign_task(
    task_id: str,
    body: AssignRequest,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> TaskOut:
    return await task_service.assign_task(task_id, body, ctx, db)


# ── Comments ──────────────────────────────────────────────────────────────────

@router.post(
    "/{task_id}/comment",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a task",
)
async def add_comment(
    task_id: str,
    body: CommentCreate,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> CommentOut:
    return await task_service.add_comment(task_id, body, ctx, db)


# ── History ───────────────────────────────────────────────────────────────────

@router.get(
    "/{task_id}/history",
    response_model=List[TaskHistoryEntry],
    summary="Get the full immutable audit trail for a task",
)
async def get_task_history(
    task_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession    = Depends(get_db),
) -> List[TaskHistoryEntry]:
    detail = await task_service.get_task(task_id, ctx, db)
    return detail.history
