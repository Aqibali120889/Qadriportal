"""
app/services/task_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 10 — Central business logic for the Kanban & Task Management system.

All other modules (API endpoints, AI pipeline hooks) interact with tasks
ONLY through this service. No business logic anywhere else.

Responsibilities:
  - Task CRUD with automatic history recording
  - Status moves (DnD) → DB + history + notification
  - Task assignment → DB + history + notification
  - Comment creation → DB + history + notification
  - AI auto-task generation hook (called from drawing_ai_service / rfq_sync_service)
  - Board data assembly (groups tasks by status for the kanban view)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.logging import get_logger
from app.models.kanban_task import (
    KanbanTask, TaskComment, TaskHistory,
    TaskEventType, TaskPriority, TaskStatus,
)
from app.models.notification import NotificationType
from app.models.project import Project
from app.repositories.kanban_task_repository import KanbanTaskRepository
from app.schemas.kanban_task import (
    AssignRequest, BoardResponse, CommentCreate, CommentOut,
    KanbanColumn, StatusUpdateRequest, TaskCreate,
    TaskDetailResponse, TaskHistoryEntry, TaskListItem,
    TaskOut, TaskUpdate,
)
from app.services.authorization_service import authorization_service
from app.services import notification_service

logger = get_logger(__name__)

# ── Status → column grouping order ───────────────────────────────────────────
ALL_STATUSES = [
    TaskStatus.TODO.value,
    TaskStatus.IN_PROGRESS.value,
    TaskStatus.WAITING_REVIEW.value,
    TaskStatus.BLOCKED.value,
    TaskStatus.COMPLETED.value,
    TaskStatus.CANCELLED.value,
]

# ── AI auto-task templates by department and trigger ─────────────────────────
CE_AUTO_TASKS = {
    "drawing_uploaded":           ("Review AI Extraction",       "ai_review"),
    "human_review_required":      ("Approve AI Fields",          "ai_review"),
    "validation_completed":       ("Verify Cost Sheet",          "rfq_sheet_verification"),
    "rfq_synchronized":           ("Verify Cost Sheet",          "rfq_sheet_verification"),
    "ai_completed":               ("Review AI Extraction",       "ai_review"),
}

FOUNDRY_AUTO_TASKS = {
    "project_created":            ("Material Selection",         "material_selection"),
    "drawing_uploaded":           ("Pattern Review",             "pattern_review"),
    "human_review_completed":     ("Moulding Preparation",       "moulding"),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_task_out(task: KanbanTask, extra: Dict[str, Any]) -> TaskOut:
    return TaskOut(
        id=task.id,
        project_id=task.project_id,
        department_id=task.department_id,
        title=task.title,
        description=task.description,
        task_type=task.task_type,
        status=task.status,
        priority=task.priority,
        sort_order=task.sort_order,
        assigned_to=task.assigned_to,
        assigned_by=task.assigned_by,
        created_by=task.created_by,
        due_date=task.due_date,
        estimated_hours=task.estimated_hours,
        completed_at=task.completed_at,
        is_ai_generated=task.is_ai_generated,
        created_at=task.created_at,
        updated_at=task.updated_at,
        **extra,
    )


def _to_task_list_item(task: KanbanTask, extra: Dict[str, Any]) -> TaskListItem:
    return TaskListItem(
        id=task.id,
        project_id=task.project_id,
        department_id=task.department_id,
        title=task.title,
        task_type=task.task_type,
        status=task.status,
        priority=task.priority,
        sort_order=task.sort_order,
        assigned_to=task.assigned_to,
        due_date=task.due_date,
        is_ai_generated=task.is_ai_generated,
        created_at=task.created_at,
        updated_at=task.updated_at,
        rfq_number=extra.get("rfq_number"),
        project_title=extra.get("project_title"),
        assignee_name=extra.get("assignee_name"),
        comments_count=extra.get("comments_count", 0),
    )


async def _write_history(
    repo: KanbanTaskRepository,
    task_id: str,
    user_id: Optional[str],
    event_type: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    entry = TaskHistory(
        task_id=task_id,
        user_id=user_id,
        event_type=event_type,
        old_value=old_value,
        new_value=new_value,
        metadata_=metadata,
    )
    await repo.add_history(entry)


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

async def get_board(
    ctx: RequestContext,
    db: AsyncSession,
    *,
    project_id: Optional[str] = None,
    department_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search: Optional[str] = None,
    my_tasks: bool = False,
    include_cancelled: bool = False,
) -> BoardResponse:
    """
    Return the Kanban board grouped by status.
    Department isolation: normal users see only their dept; Super Admin can target any.
    """
    repo = KanbanTaskRepository(db)

    # Determine effective department_id
    if ctx.is_super_admin:
        eff_dept = department_id  # can be None (all depts) or specific
    else:
        eff_dept = ctx.department_id

    if my_tasks:
        assigned_to = ctx.user_id

    tasks = await repo.get_board(
        department_id=eff_dept,
        project_id=project_id,
        assigned_to=assigned_to,
        status_filter=status_filter,
        priority_filter=priority_filter,
        search=search,
        exclude_cancelled=not include_cancelled,
    )

    bulk_extra = await repo.enrich_tasks_bulk(tasks)

    # Group by status
    grouped: Dict[str, List[TaskListItem]] = {s: [] for s in ALL_STATUSES}
    for task in tasks:
        extra = bulk_extra.get(task.id, {})
        item = _to_task_list_item(task, extra)
        if task.status in grouped:
            grouped[task.status].append(item)

    columns = [
        KanbanColumn(status=s, tasks=grouped[s], count=len(grouped[s]))
        for s in ALL_STATUSES
    ]
    return BoardResponse(columns=columns, total=len(tasks), dept_id=eff_dept)


async def get_task(task_id: str, ctx: RequestContext, db: AsyncSession) -> TaskDetailResponse:
    repo = KanbanTaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not ctx.is_super_admin and task.department_id != ctx.department_id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    extra = await repo.enrich_task(task)
    task_out = _to_task_out(task, extra)

    raw_comments = await repo.get_comments(task_id)
    enriched_comments = await repo.enrich_comments(raw_comments)
    comments_out = [CommentOut(**c) for c in enriched_comments]

    raw_history = await repo.get_history(task_id)
    enriched_history = await repo.enrich_history(raw_history)
    history_out = [TaskHistoryEntry(**h) for h in enriched_history]

    return TaskDetailResponse(task=task_out, comments=comments_out, history=history_out)


async def create_task(
    body: TaskCreate,
    ctx: RequestContext,
    db: AsyncSession,
) -> TaskOut:
    repo = KanbanTaskRepository(db)

    # Resolve dept for this project
    dept_id = ctx.department_id

    task = KanbanTask(
        project_id=body.project_id,
        department_id=dept_id,
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        priority=body.priority,
        assigned_to=body.assigned_to,
        assigned_by=ctx.user_id if body.assigned_to else None,
        created_by=ctx.user_id,
        due_date=body.due_date,
        estimated_hours=body.estimated_hours,
        status=TaskStatus.TODO.value,
        is_ai_generated=False,
    )
    task = await repo.create_task(task)

    await _write_history(repo, task.id, ctx.user_id, TaskEventType.CREATED.value,
                         new_value=body.title)

    if body.assigned_to:
        await _write_history(repo, task.id, ctx.user_id, TaskEventType.ASSIGNED.value,
                             new_value=body.assigned_to)

    await db.commit()

    # Notify assignee
    if body.assigned_to:
        proj = (await db.execute(
            select(Project.rfq_number, Project.id).where(Project.id == body.project_id)
        )).first()
        await notification_service.notify(
            db,
            event_type="task_assigned",
            title=f"Task Assigned: {body.title}",
            message=f"You have been assigned a new task on {proj.rfq_number if proj else 'a project'}.",
            severity=NotificationType.TASK,
            project_id=body.project_id,
            department_id=dept_id,
            user_id=body.assigned_to,
            rfq_number=proj.rfq_number if proj else None,
        )

    extra = await repo.enrich_task(task)
    return _to_task_out(task, extra)


async def update_task(
    task_id: str,
    body: TaskUpdate,
    ctx: RequestContext,
    db: AsyncSession,
) -> TaskOut:
    repo = KanbanTaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not ctx.is_super_admin and task.department_id != ctx.department_id:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Access denied")

    patch: Dict[str, Any] = {}
    if body.title is not None and body.title != task.title:
        await _write_history(repo, task_id, ctx.user_id, TaskEventType.TITLE_CHANGED.value,
                             old_value=task.title, new_value=body.title)
        patch["title"] = body.title

    if body.priority is not None and body.priority != task.priority:
        await _write_history(repo, task_id, ctx.user_id, TaskEventType.PRIORITY_CHANGED.value,
                             old_value=task.priority, new_value=body.priority)
        patch["priority"] = body.priority

    if body.due_date is not None and body.due_date != task.due_date:
        await _write_history(repo, task_id, ctx.user_id, TaskEventType.DUE_DATE_CHANGED.value,
                             old_value=str(task.due_date), new_value=str(body.due_date))
        patch["due_date"] = body.due_date

    if body.description is not None:
        patch["description"] = body.description
    if body.task_type is not None:
        patch["task_type"] = body.task_type
    if body.estimated_hours is not None:
        patch["estimated_hours"] = body.estimated_hours

    if body.assigned_to is not None and body.assigned_to != task.assigned_to:
        patch["assigned_to"] = body.assigned_to
        patch["assigned_by"] = ctx.user_id
        await _write_history(repo, task_id, ctx.user_id, TaskEventType.ASSIGNED.value,
                             old_value=task.assigned_to, new_value=body.assigned_to)

    if patch:
        await repo.update_task(task_id, patch)

    await db.commit()
    task = await repo.get_by_id(task_id)
    extra = await repo.enrich_task(task)
    return _to_task_out(task, extra)


async def move_status(
    task_id: str,
    body: StatusUpdateRequest,
    ctx: RequestContext,
    db: AsyncSession,
) -> TaskOut:
    """
    DnD status change. Validates transition, persists, writes history,
    fires notification, broadcasts via SSE.
    """
    repo = KanbanTaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not ctx.is_super_admin and task.department_id != ctx.department_id:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Access denied")

    old_status = task.status
    new_status = body.status

    if old_status == new_status:
        extra = await repo.enrich_task(task)
        return _to_task_out(task, extra)

    await repo.update_status(task_id, new_status)

    ev = (TaskEventType.COMPLETED.value if new_status == TaskStatus.COMPLETED.value
          else TaskEventType.REOPENED.value if old_status == TaskStatus.COMPLETED.value
          else TaskEventType.STATUS_CHANGED.value)
    await _write_history(repo, task_id, ctx.user_id, ev,
                         old_value=old_status, new_value=new_status)

    await db.commit()

    # Notify relevant parties
    proj = (await db.execute(
        select(Project.rfq_number).where(Project.id == task.project_id)
    )).scalar_one_or_none()

    severity = NotificationType.SUCCESS if new_status == TaskStatus.COMPLETED.value else NotificationType.INFO
    await notification_service.notify(
        db,
        event_type=f"task_{ev}",
        title=f"Task {new_status.replace('_', ' ').title()}: {task.title}",
        message=f"Status changed from {old_status} → {new_status}",
        severity=severity,
        project_id=task.project_id,
        department_id=task.department_id,
        rfq_number=proj,
        metadata={"task_id": task_id, "old_status": old_status, "new_status": new_status},
    )

    task = await repo.get_by_id(task_id)
    extra = await repo.enrich_task(task)
    return _to_task_out(task, extra)


async def assign_task(
    task_id: str,
    body: AssignRequest,
    ctx: RequestContext,
    db: AsyncSession,
) -> TaskOut:
    repo = KanbanTaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not ctx.is_super_admin and task.department_id != ctx.department_id:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Access denied")

    old_assignee = task.assigned_to
    await repo.update_assignment(task_id, body.assigned_to, ctx.user_id)

    ev = TaskEventType.UNASSIGNED.value if not body.assigned_to else TaskEventType.ASSIGNED.value
    await _write_history(repo, task_id, ctx.user_id, ev,
                         old_value=old_assignee, new_value=body.assigned_to)

    await db.commit()

    if body.assigned_to:
        proj = (await db.execute(
            select(Project.rfq_number).where(Project.id == task.project_id)
        )).scalar_one_or_none()
        await notification_service.notify(
            db,
            event_type="task_assigned",
            title=f"Task Assigned: {task.title}",
            message=f"You have been assigned a task on {proj or 'a project'}.",
            severity=NotificationType.TASK,
            project_id=task.project_id,
            department_id=task.department_id,
            user_id=body.assigned_to,
            rfq_number=proj,
        )

    task = await repo.get_by_id(task_id)
    extra = await repo.enrich_task(task)
    return _to_task_out(task, extra)


async def add_comment(
    task_id: str,
    body: CommentCreate,
    ctx: RequestContext,
    db: AsyncSession,
) -> CommentOut:
    repo = KanbanTaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not ctx.is_super_admin and task.department_id != ctx.department_id:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Access denied")

    comment = TaskComment(
        task_id=task_id,
        user_id=ctx.user_id,
        department_id=ctx.department_id,
        content=body.content,
    )
    comment = await repo.add_comment(comment)
    await _write_history(repo, task_id, ctx.user_id, TaskEventType.COMMENT_ADDED.value,
                         new_value=body.content[:100])
    await db.commit()

    enriched = await repo.enrich_comments([comment])
    return CommentOut(**enriched[0])


async def cancel_task(task_id: str, ctx: RequestContext, db: AsyncSession) -> None:
    repo = KanbanTaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not ctx.is_super_admin and task.department_id != ctx.department_id:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Access denied")

    await repo.update_status(task_id, TaskStatus.CANCELLED.value)
    await _write_history(repo, task_id, ctx.user_id, TaskEventType.CANCELLED.value,
                         old_value=task.status, new_value=TaskStatus.CANCELLED.value)
    await db.commit()


async def get_dept_users(ctx: RequestContext, db: AsyncSession) -> List[Dict[str, Any]]:
    repo = KanbanTaskRepository(db)
    dept_id = ctx.department_id if not ctx.is_super_admin else None
    if dept_id:
        users = await repo.get_dept_users(dept_id)
    else:
        from sqlalchemy import select
        from app.models.user import User
        result = await db.execute(
            select(User).where(User.is_active.is_(True)).where(User.deleted_at.is_(None))
        )
        users = list(result.scalars().all())

    return [
        {
            "id": u.id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
            "email": u.email,
            "department_id": u.department_id,
        }
        for u in users
    ]


async def get_projects_for_kanban(
    ctx: RequestContext,
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    """
    Return projects scoped to the caller's department for the Kanban
    Create Task modal project/RFQ selector.

    Super Admins receive all projects.
    Normal users receive projects where current_department_id matches.
    Sorted by rfq_number / job_number for predictable display order.
    """
    from sqlalchemy import or_, func as sqlfunc

    stmt = select(
        Project.id,
        Project.job_number,
        Project.rfq_number,
        Project.title,
        Project.current_department_id,
        Project.status,
    ).where(Project.deleted_at.is_(None))

    # Department isolation (Super Admin & Foundry receive all projects)
    dept_filter = authorization_service.filter_projects_by_department(ctx)
    if dept_filter:
        stmt = stmt.where(Project.current_department_id == dept_filter)

    # Optional search
    if search:
        q = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                sqlfunc.lower(Project.rfq_number).like(q),
                sqlfunc.lower(Project.job_number).like(q),
                sqlfunc.lower(Project.title).like(q),
            )
        )

    stmt = stmt.order_by(Project.rfq_number, Project.job_number).limit(limit)
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id":           str(r.id),
            "rfq_number":   r.rfq_number or r.job_number,
            "job_number":   r.job_number,
            "title":        r.title or r.rfq_number or r.job_number,
            "status":       r.status,
            "department_id": str(r.current_department_id) if r.current_department_id else None,
        }
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════════════
# AI AUTO-TASK GENERATION
# ══════════════════════════════════════════════════════════════════════════════

async def auto_generate_task(
    project_id: str,
    event_trigger: str,
    department_code: str,
    department_id: str,
    created_by_user_id: Optional[str],
    db: AsyncSession,
) -> Optional[KanbanTask]:
    """
    Called by AI pipeline hooks (drawing_ai_service, rfq_sync_service).
    Creates a task automatically when a pipeline event fires, IF:
      1. The project has auto_tasks_enabled = true
      2. A template exists for this event + department combination
    """
    repo = KanbanTaskRepository(db)

    # Check per-project setting
    enabled = await repo.project_auto_tasks_enabled(project_id)
    if not enabled:
        logger.info("auto_task_skipped_disabled", project_id=project_id, event=event_trigger)
        return None

    # Resolve template
    templates = CE_AUTO_TASKS if department_code == "CE" else FOUNDRY_AUTO_TASKS
    template = templates.get(event_trigger)
    if not template:
        return None

    title, task_type = template

    # Avoid duplicating the same auto-task for same project + type
    from sqlalchemy import and_
    existing = await db.execute(
        select(KanbanTask).where(
            and_(
                KanbanTask.project_id == project_id,
                KanbanTask.task_type == task_type,
                KanbanTask.is_ai_generated.is_(True),
                KanbanTask.status.notin_([TaskStatus.COMPLETED.value, TaskStatus.CANCELLED.value]),
            )
        )
    )
    if existing.scalar_one_or_none():
        logger.info("auto_task_already_exists", project_id=project_id, task_type=task_type)
        return None

    task = KanbanTask(
        project_id=project_id,
        department_id=department_id,
        title=title,
        task_type=task_type,
        priority=TaskPriority.HIGH.value,
        status=TaskStatus.TODO.value,
        is_ai_generated=True,
        created_by=created_by_user_id,
    )
    task = await repo.create_task(task)
    await _write_history(repo, task.id, created_by_user_id, TaskEventType.AI_GENERATED.value,
                         new_value=f"Auto-generated from event: {event_trigger}")
    await db.commit()

    # Notify department
    proj = (await db.execute(
        select(Project.rfq_number).where(Project.id == project_id)
    )).scalar_one_or_none()

    await notification_service.notify(
        db,
        event_type="task_ai_generated",
        title=f"AI Generated Task: {title}",
        message=f"A new task was auto-created for {proj or project_id}.",
        severity=NotificationType.INFO,
        project_id=project_id,
        department_id=department_id,
        rfq_number=proj,
        metadata={"task_id": task.id, "trigger": event_trigger},
    )

    logger.info("auto_task_created", task_id=task.id, title=title, project_id=project_id)
    return task
