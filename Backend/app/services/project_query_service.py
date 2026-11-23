"""
app/services/project_query_service.py
─────────────────────────────────────────────────────────────────────────────
Read-side service for project queries.

Responsibilities:
- Build enriched ProjectDetailResponse from ORM models
- Generate signed URLs for drawing files via Supabase Storage
- Assemble paginated project lists

This service is intentionally read-only — it never modifies data.
"""

from __future__ import annotations

from typing import Optional, Tuple, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import DrawingNotFoundError, EmailNotFoundError, ProjectNotFoundError
from app.core.logging import get_logger
from app.repositories.drawing_repository import DrawingRepository
from app.repositories.email_repository import EmailRepository
from app.repositories.file_repository import FileRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import (
    AttachmentSchema,
    DrawingSchema,
    EmailSchema,
    FileSchema,
    PaginatedProjectList,
    ProjectDetailResponse,
    ProjectListItem,
)

from app.core.context import RequestContext
from app.services.authorization_service import authorization_service

logger = get_logger(__name__)
settings = get_settings()


# ── Signed URL Helper ─────────────────────────────────────────────────────────

async def _get_signed_url(storage_path: Optional[str]) -> Optional[str]:
    """
    Generate a temporary signed URL for a Supabase Storage object.
    Returns None if storage_path is not set or if generation fails.
    """
    if not storage_path:
        return None
    try:
        from supabase import create_client
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        response = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).create_signed_url(
            path=storage_path,
            expires_in=3600,  # 1 hour
        )
        return response.get("signedURL") or response.get("signedUrl")
    except Exception as exc:
        logger.warning("signed_url_generation_failed", path=storage_path, error=str(exc))
        return None


# ── Service Functions ─────────────────────────────────────────────────────────

async def get_project_detail(
    project_id: str,
    session: AsyncSession,
    ctx: Optional[RequestContext] = None,
) -> ProjectDetailResponse:
    """
    Build a fully-enriched project detail response.
    Raises ProjectNotFoundError if the project does not exist.
    Validates department access if ctx is provided.
    """
    project_repo = ProjectRepository(session)
    project = await project_repo.get_by_id_full(project_id)

    if not project:
        raise ProjectNotFoundError(project_id)

    if ctx is not None:
        authorization_service.assert_project_access(ctx, project.current_department_id)

    # Email (first linked email)
    email_schema: Optional[EmailSchema] = None
    if project.emails:
        em = project.emails[0]
        email_schema = EmailSchema(
            id=em.id,
            subject=em.subject,
            body=em.body,
            body_preview=em.body_preview,
            sender_email=em.sender_email,
            received_at=em.received_at,
            attachments=[
                AttachmentSchema(
                    id=a.id,
                    attachment_name=a.attachment_name,
                    attachment_size=a.attachment_size,
                    file=FileSchema.model_validate(a.file) if a.file else None,
                )
                for a in em.attachments
            ],
        )

    # Drawing (first PDF drawing)
    drawing_schema: Optional[DrawingSchema] = None
    if project.drawings:
        d = project.drawings[0]
        signed_url = await _get_signed_url(d.file.storage_path if d.file else None)
        drawing_schema = DrawingSchema(
            id=d.id,
            drawing_title=d.drawing_title,
            drawing_number=d.drawing_number,
            revision=d.revision,
            total_pages=d.total_pages,
            file=FileSchema.model_validate(d.file) if d.file else None,
            signed_url=signed_url,
            created_at=d.created_at,
        )

    # All files
    files = [FileSchema.model_validate(f) for f in project.files]

    return ProjectDetailResponse(
        id=project.id,
        job_number=project.job_number,
        title=project.title,
        status=project.status.value,
        priority=project.priority,
        current_department_id=project.current_department_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        email=email_schema,
        drawing=drawing_schema,
        files=files,
    )


async def get_projects_paginated(
    page: int,
    page_size: int,
    session: AsyncSession,
    department_id: Optional[str] = None,
) -> dict:
    """
    Return a paginated list of projects with lightweight summary data.

    Args:
        department_id: If provided, filters to projects where
                       current_department_id = department_id (normal users).
                       If None, returns all projects (Super Admin).
    """
    project_repo = ProjectRepository(session)
    skip = (page - 1) * page_size
    projects, total = await project_repo.get_paginated(
        skip=skip, limit=page_size, department_id=department_id
    )

    items = []
    for p in projects:
        first_email = p.emails[0] if p.emails else None
        items.append(
            ProjectListItem(
                id=p.id,
                job_number=p.job_number,
                title=p.title,
                status=p.status.value,
                priority=p.priority,
                sender_email=first_email.sender_email if first_email else None,
                attachment_count=len(first_email.attachments) if first_email and first_email.attachments else 0,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


async def get_project_email(
    project_id: str,
    session: AsyncSession,
) -> EmailSchema:
    """Return the email details for a specific project."""
    project_repo = ProjectRepository(session)
    project = await project_repo.get_by_id_full(project_id)
    if not project:
        raise ProjectNotFoundError(project_id)

    if not project.emails:
        raise EmailNotFoundError(
            message=f"No email found for project {project_id}",
        )

    em = project.emails[0]
    return EmailSchema(
        id=em.id,
        subject=em.subject,
        body=em.body,
        body_preview=em.body_preview,
        sender_email=em.sender_email,
        received_at=em.received_at,
        attachments=[
            AttachmentSchema(
                id=a.id,
                attachment_name=a.attachment_name,
                attachment_size=a.attachment_size,
                file=FileSchema.model_validate(a.file) if a.file else None,
            )
            for a in em.attachments
        ],
    )


async def get_project_drawing(
    project_id: str,
    session: AsyncSession,
) -> DrawingSchema:
    """Return the primary drawing with a fresh signed URL for a specific project."""
    project_repo = ProjectRepository(session)
    project = await project_repo.get_by_id_full(project_id)
    if not project:
        raise ProjectNotFoundError(project_id)

    if not project.drawings:
        raise DrawingNotFoundError(
            message=f"No drawing found for project {project_id}",
        )

    d = project.drawings[0]
    signed_url = await _get_signed_url(d.file.storage_path if d.file else None)

    return DrawingSchema(
        id=d.id,
        drawing_title=d.drawing_title,
        drawing_number=d.drawing_number,
        revision=d.revision,
        total_pages=d.total_pages,
        file=FileSchema.model_validate(d.file) if d.file else None,
        signed_url=signed_url,
        created_at=d.created_at,
    )


# ── Phase 3: Dashboard Stats ──────────────────────────────────────────────────

async def get_dashboard_stats(
    department_id: str,
    department_name: str,
    department_code: str,
    session: AsyncSession,
):
    """
    Return KPI counters (project counts by status) for the given department.
    Used by the dashboard KPI cards.
    """
    from app.schemas.project import DepartmentStatsResponse
    project_repo = ProjectRepository(session)
    counts = await project_repo.get_department_stats(department_id)
    return DepartmentStatsResponse(
        department_id=department_id,
        department_name=department_name,
        department_code=department_code,
        total=counts["total"],
        draft=counts["draft"],
        active=counts["active"],
        on_hold=counts["on_hold"],
        completed=counts["completed"],
        cancelled=counts["cancelled"],
    )


# ── Phase 3: Kanban Board ─────────────────────────────────────────────────────

async def get_kanban_board(
    department_id: Optional[str],
    department_code: str,
    session: AsyncSession,
):
    """
    Return all Kanban task cards for the department (or all depts if Super Admin).
    Projects are mapped to Kanban column IDs by their status.

    Drawing/AI/Excel status are derived at read time (no new columns) from
    the latest drawings/ocr_jobs rows and rfq_sessions existence — batched
    into two queries rather than N+1 per card.
    """
    from sqlalchemy import text
    from app.schemas.project import KanbanBoardResponse, KanbanTaskItem, KANBAN_COLUMN_MAP
    project_repo = ProjectRepository(session)
    projects = await project_repo.get_kanban_tasks(department_id=department_id)

    project_ids = [p.id for p in projects]
    rfq_numbers = [p.rfq_number for p in projects if p.rfq_number]

    drawing_map: dict = {}
    ai_status_map: dict = {}
    excel_set: set = set()

    if project_ids:
        drawing_rows = await session.execute(text("""
            SELECT DISTINCT ON (project_id) project_id, drawing_number
            FROM drawings
            WHERE project_id::text = ANY(:ids)
            ORDER BY project_id, created_at DESC
        """), {"ids": project_ids})
        for r in drawing_rows.mappings():
            drawing_map[str(r["project_id"])] = r["drawing_number"]

        ai_rows = await session.execute(text("""
            SELECT DISTINCT ON (project_id) project_id, processing_status
            FROM ocr_jobs
            WHERE project_id::text = ANY(:ids)
            ORDER BY project_id, created_at DESC
        """), {"ids": project_ids})
        for r in ai_rows.mappings():
            ai_status_map[str(r["project_id"])] = r["processing_status"]

    if rfq_numbers:
        excel_rows = await session.execute(text("""
            SELECT DISTINCT rfq_number FROM rfq_sessions WHERE rfq_number = ANY(:nums)
        """), {"nums": rfq_numbers})
        excel_set = {r[0] for r in excel_rows}

    tasks = []
    for p in projects:
        first_email = p.emails[0] if p.emails else None
        attachment_count = (
            len(first_email.attachments)
            if first_email and first_email.attachments
            else 0
        )
        tasks.append(
            KanbanTaskItem(
                id=p.id,
                job_number=p.job_number,
                rfq_number=p.rfq_number or p.job_number,
                title=p.title,
                status=p.status.value,
                kanban_column=KANBAN_COLUMN_MAP.get(p.status.value, "pending"),
                priority=p.priority,
                sender_email=first_email.sender_email if first_email else None,
                attachment_count=attachment_count,
                estimated_completion=(
                    p.estimated_completion.isoformat() if p.estimated_completion else None
                ),
                created_at=p.created_at,
                updated_at=p.updated_at,
                drawing_number=drawing_map.get(p.id),
                drawing_status="RECEIVED" if p.id in drawing_map else "NONE",
                ai_status=ai_status_map.get(p.id, "NONE"),
                has_excel_session=bool(p.rfq_number and p.rfq_number in excel_set),
            )
        )

    return KanbanBoardResponse(
        department_id=department_id or "",
        department_code=department_code,
        tasks=tasks,
    )
