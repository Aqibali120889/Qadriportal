"""
app/services/notification_service.py
─────────────────────────────────────────────────────────────────────────────
Centralized notification entry point. Every module that needs to notify a
user/department calls `notification_service.notify(...)` — nobody writes to
the `notifications` table directly, and nobody hand-rolls a frontend route.

Because HistoryRepository.get_department_feed() already unions the
`notifications` table into the History activity feed, writing a notification
here *is* creating the corresponding History entry — no separate sync step.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.notification import Notification, NotificationType
from app.models.project import Project
from app.services.notification_broker import notification_broker

logger = get_logger(__name__)


# ── Event → Route mapping ────────────────────────────────────────────────────
# Centralized here so the frontend never needs its own copy of this mapping —
# it just navigates to whatever `route` came back on the notification.
# department_code is optional: most of today's pipeline (drawing/AI/review)
# runs through the same Cost-Estimation-shaped workspace regardless of which
# department owns the project, so CE-style routes are the safe default.

def _build_route(event_type: str, project_id: Optional[str], rfq_number: Optional[str], department_code: Optional[str]) -> Optional[str]:
    is_foundry = department_code == "FOUNDRY"

    if event_type in (
        "ai_queued", "ai_processing", "ai_completed", "ai_failed",
        "ai_reprocessed", "ai_cached",
        "human_review_required", "human_review_completed",
        "field_edited", "validation_completed",
        "drawing_uploaded",
    ):
        if not project_id:
            return "/foundry/workspace" if is_foundry else "/dashboard/drawing-workspace"
        return (
            f"/foundry/workspace?projectId={project_id}" if is_foundry
            else f"/dashboard/drawing-workspace?projectId={project_id}"
        )

    if event_type in ("rfq_updated", "rfq_synchronized", "sheet_updated"):
        if is_foundry:
            return f"/foundry/workspace?projectId={project_id}" if project_id else "/foundry/workspace"
        if rfq_number:
            return f"/dashboard/rfq-sheet/{rfq_number}"
        return "/dashboard/drawing-workspace"

    if event_type in ("new_rfq_email", "email_received", "email_processing_failed"):
        return "/foundry" if is_foundry else "/dashboard"

    if event_type in ("project_created", "project_status_changed", "project_transferred", "project_archived", "project_completed"):
        return "/foundry" if is_foundry else "/dashboard"

    # ── Phase 10: Task / Kanban events ────────────────────────────────────────
    # Kanban lives on the main department dashboard (/dashboard or /foundry)
    if event_type in (
        "task_assigned", "task_status_changed", "task_completed",
        "task_reopened", "task_cancelled", "task_comment_added",
        "task_ai_generated", "task_overdue", "task_created",
    ):
        base = "/foundry" if is_foundry else "/dashboard"
        if project_id:
            return f"{base}?projectId={project_id}"
        return base

    # System events (login/logout/config/background job) — no specific target
    return None


async def notify(
    db: AsyncSession,
    *,
    event_type: str,
    title: str,
    message: Optional[str] = None,
    severity: NotificationType = NotificationType.INFO,
    project_id: Optional[str] = None,
    department_id: Optional[str] = None,
    department_code: Optional[str] = None,
    user_id: Optional[str] = None,
    rfq_number: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Notification:
    """
    Create a notification, persist it, and broadcast it live to any connected
    SSE subscribers for its department. Never raises on broadcast failure —
    delivery is best-effort; persistence is not.
    """
    if project_id is not None:
        proj_stmt = select(Project.rfq_number, Project.current_department_id).where(Project.id == project_id)
        proj_row = (await db.execute(proj_stmt)).first()
        if proj_row:
            if rfq_number is None:
                rfq_number = proj_row[0]
            if department_id is None and proj_row[1]:
                department_id = proj_row[1]

    if department_code is None and department_id is not None:
        from app.models.department import Department
        dept_code_res = (await db.execute(select(Department.code).where(Department.id == department_id))).scalar_one_or_none()
        if dept_code_res:
            department_code = dept_code_res

    route = _build_route(event_type, project_id, rfq_number, department_code)

    notif = Notification(
        user_id=user_id,
        department_id=department_id,
        project_id=project_id,
        title=title,
        message=message,
        notification_type=severity,
        event_type=event_type,
        route=route,
        metadata_=metadata,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    logger.info(
        "notification_created",
        event_type=event_type,
        project_id=project_id,
        department_id=department_id,
        notification_id=notif.id,
    )

    await notification_broker.publish(department_id, {
        "id": notif.id,
        "project_id": notif.project_id,
        "rfq_number": rfq_number,
        "department_id": notif.department_id,
        "user_id": notif.user_id,
        "event_type": notif.event_type,
        "notification_type": notif.notification_type.value,
        "title": notif.title,
        "message": notif.message,
        "route": notif.route,
        "is_read": notif.is_read,
        "metadata": notif.metadata_,
        "created_at": notif.created_at.isoformat() if notif.created_at else None,
        "read_at": None,
    })

    return notif
