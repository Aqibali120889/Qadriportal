"""
app/api/v1/projects.py
─────────────────────────────────────────────────────────────────────────────
Project query endpoints consumed by the React frontend.

All endpoints require a valid JWT (via get_request_context).
Department isolation is enforced automatically:
  - Normal users see only projects where current_department_id = their department
  - Super Admin sees all projects across all departments

Endpoints:
  GET /projects                      — paginated project list (department-scoped)
  GET /projects/{project_id}         — full project detail (email + drawing + files)
  GET /projects/{project_id}/email   — email details for a project
  GET /projects/{project_id}/drawing — primary drawing with signed URL
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.exceptions import (
    DrawingNotFoundError,
    EmailNotFoundError,
    ProjectNotFoundError,
)
from app.core.logging import get_logger
from app.schemas.project import (
    DrawingSchema,
    EmailSchema,
    ProjectDetailResponse,
    DepartmentStatsResponse,
    KanbanBoardResponse,
    ProjectStatusUpdate,
)
from app.models.notification import NotificationType
from app.services import notification_service
from app.services.authorization_service import authorization_service
from app.services.project_query_service import (
    get_project_detail,
    get_project_drawing,
    get_project_email,
    get_projects_paginated,
    get_dashboard_stats,
    get_kanban_board,
)

logger = get_logger(__name__)

router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


@router.get(
    "",
    summary="List Projects",
    description=(
        "Returns a paginated list of projects. "
        "Normal users see only their department's projects. "
        "Super Admin sees all projects across all departments."
    ),
    responses={
        200: {"description": "Paginated project list"},
        401: {"description": "Missing or invalid JWT"},
    },
)
async def list_projects(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Resolve department filter — None for Super Admin and Foundry (no filter), str for CE
    dept_filter = authorization_service.filter_projects_by_department(ctx)

    logger.info(
        "projects_list_requested",
        user_id=ctx.user_id,
        department_filter=dept_filter or "ALL",
        page=page,
    )

    return await get_projects_paginated(
        page=page,
        page_size=page_size,
        session=db,
        department_id=dept_filter,
    )


# ── Phase 3: Dashboard Stats ──────────────────────────────────────────────────

@router.get(
    "/stats",
    response_model=DepartmentStatsResponse,
    summary="Department Dashboard Stats",
    description=(
        "Returns project counts by status for the authenticated user's department. "
        "Super Admin receives counts across all departments."
    ),
)
async def get_stats(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> DepartmentStatsResponse:
    dept_filter = authorization_service.filter_projects_by_department(ctx)
    return await get_dashboard_stats(
        department_id=dept_filter or ctx.department_id,
        department_name=ctx.department_name,
        department_code=ctx.department_code,
        session=db,
    )


# ── Phase 3: Kanban Board ─────────────────────────────────────────────────────

@router.get(
    "/kanban",
    response_model=KanbanBoardResponse,
    summary="Kanban Board Data",
    description=(
        "Returns all projects for the department as Kanban cards, "
        "each pre-mapped to its Kanban column (pending/in-progress/review/completed). "
        "Super Admin and Foundry receive all departments."
    ),
)
async def get_kanban(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> KanbanBoardResponse:
    dept_filter = authorization_service.filter_projects_by_department(ctx)
    return await get_kanban_board(
        department_id=dept_filter,
        department_code=ctx.department_code,
        session=db,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectDetailResponse,
    summary="Get Project Detail",
    description=(
        "Returns a fully-enriched project record including email content, "
        "drawing metadata with signed URL, and all attachment files. "
        "Department access is validated before returning data."
    ),
    responses={
        200: {"description": "Full project detail"},
        401: {"description": "Missing or invalid JWT"},
        403: {"description": "Department access denied"},
        404: {"description": "Project not found"},
    },
)
async def get_project(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> ProjectDetailResponse:
    try:
        return await get_project_detail(project_id=project_id, session=db, ctx=ctx)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.get(
    "/{project_id}/email",
    response_model=EmailSchema,
    summary="Get Project Email",
    description="Returns the originating email (subject, body, sender, attachments) for a project.",
    responses={
        200: {"description": "Email detail"},
        401: {"description": "Missing or invalid JWT"},
        404: {"description": "Project or email not found"},
    },
)
async def get_email(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> EmailSchema:
    try:
        return await get_project_email(project_id=project_id, session=db)
    except (ProjectNotFoundError, EmailNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.get(
    "/{project_id}/drawing",
    response_model=DrawingSchema,
    summary="Get Project Drawing",
    description=(
        "Returns the primary engineering drawing for a project. "
        "Includes a 1-hour signed URL for direct download from Supabase Storage."
    ),
    responses={
        200: {"description": "Drawing detail with signed URL"},
        401: {"description": "Missing or invalid JWT"},
        404: {"description": "Project or drawing not found"},
    },
)
async def get_drawing(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> DrawingSchema:
    try:
        return await get_project_drawing(project_id=project_id, session=db)
    except (ProjectNotFoundError, DrawingNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


# ── Phase 3: Status Update (Kanban drag-and-drop) ─────────────────────────────

_VALID_STATUSES = {"DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"}


@router.patch(
    "/{project_id}/status",
    summary="Update Project Status",
    description=(
        "Updates a project's workflow status (Kanban drag-and-drop). "
        "Allowed values: DRAFT | ACTIVE | ON_HOLD | COMPLETED | CANCELLED."
    ),
    responses={
        200: {"description": "Status updated successfully"},
        400: {"description": "Invalid status value"},
        401: {"description": "Missing or invalid JWT"},
        404: {"description": "Project not found"},
    },
)
async def update_project_status(
    project_id: str,
    body: ProjectStatusUpdate,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    new_status = body.status.upper()
    if new_status not in _VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATUS",
                "message": f"Status '{new_status}' is not valid. "
                           f"Allowed: {sorted(_VALID_STATUSES)}",
            },
        )

    from app.repositories.project_repository import ProjectRepository
    from app.schemas.project import KANBAN_COLUMN_MAP

    repo = ProjectRepository(db)
    project = await repo.update_status(
        project_id=project_id,
        new_status=new_status,
        updated_by=ctx.user_id,
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    logger.info(
        "project_status_updated",
        project_id=project_id,
        new_status=new_status,
        updated_by=ctx.user_id,
        department=ctx.department_code,
    )

    try:
        event_type = "project_archived" if new_status == "CANCELLED" else (
            "project_completed" if new_status == "COMPLETED" else "project_status_changed"
        )
        await notification_service.notify(
            db,
            event_type=event_type,
            title=f"Project {project.job_number} — {new_status}",
            message=f"Status changed to {new_status} by {ctx.role_name}.",
            severity=NotificationType.SUCCESS if new_status == "COMPLETED" else NotificationType.INFO,
            project_id=project_id,
            department_id=project.current_department_id,
            department_code=ctx.department_code,
            rfq_number=project.rfq_number or project.job_number,
            user_id=ctx.user_id,
        )
    except Exception as notif_exc:
        logger.warning("notification_emit_failed", error=str(notif_exc))

    return {
        "id": project_id,
        "status": new_status,
        "kanban_column": KANBAN_COLUMN_MAP.get(new_status, "pending"),
    }
