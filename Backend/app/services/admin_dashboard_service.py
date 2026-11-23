"""
app/services/admin_dashboard_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 11.1 — Super Admin Dashboard aggregation service.

Runs 5 optimised SQL queries to build the full dashboard payload.
No N+1 queries. All aggregation is server-side.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from sqlalchemy import case, extract, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.department import Department
from app.models.notification import Notification
from app.models.project import Project, ProjectStatus
from app.models.user import User

logger = get_logger(__name__)


# ── Status → frontend display name ────────────────────────────────────────────
STATUS_DISPLAY: Dict[str, str] = {
    "DRAFT":     "new",
    "ACTIVE":    "in-progress",
    "ON_HOLD":   "pending",
    "COMPLETED": "completed",
    "CANCELLED": "delayed",
}

# ── Status → progress % ────────────────────────────────────────────────────────
STATUS_PROGRESS: Dict[str, int] = {
    "DRAFT":     10,
    "ACTIVE":    50,
    "ON_HOLD":   30,
    "COMPLETED": 100,
    "CANCELLED": 0,
}

# ── Department name → accent colour ───────────────────────────────────────────
DEPT_COLORS: Dict[str, str] = {
    "Marketing":        "#8B5CF6",
    "Cost Estimation":  "#3B82F6",
    "Foundry":          "#F59E0B",
    "QEN":              "#10B981",
    "Fabrication":      "#EF4444",
    "Admin":            "#F5821F",
}

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


async def get_dashboard_data(db: AsyncSession) -> Dict[str, Any]:
    """
    Build the complete Super Admin dashboard payload.
    Returns a single dict consumed by GET /api/v1/admin/dashboard.
    """

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_naive = today_start.replace(tzinfo=None)

    six_months_ago_naive = (now - timedelta(days=180)).replace(tzinfo=None)

    # ── Statements ──────────────────────────────────────────────────────────
    agg_stmt = select(
        func.count().label("total"),
        func.sum(case((Project.status == ProjectStatus.DRAFT,     1), else_=0)).label("draft"),
        func.sum(case((Project.status == ProjectStatus.ACTIVE,    1), else_=0)).label("active"),
        func.sum(case((Project.status == ProjectStatus.ON_HOLD,   1), else_=0)).label("on_hold"),
        func.sum(case((Project.status == ProjectStatus.COMPLETED, 1), else_=0)).label("completed"),
        func.sum(case((Project.status == ProjectStatus.CANCELLED, 1), else_=0)).label("cancelled"),
        func.sum(case((Project.created_at >= today_start_naive,   1), else_=0)).label("today"),
    ).select_from(Project).where(Project.deleted_at.is_(None))

    user_stmt = select(
        func.count().label("total_users"),
        func.sum(case((User.status == "ACTIVE", 1), else_=0)).label("active_users"),
    ).select_from(User).where(User.deleted_at.is_(None))

    ai_jobs_stmt = text("SELECT COUNT(*) FROM ocr_jobs")
    pending_reviews_stmt = text("SELECT COUNT(*) FROM extracted_entities WHERE review_status = 'pending'")
    kanban_tasks_stmt = text("SELECT COUNT(*) FROM kanban_tasks")
    security_events_stmt = text("SELECT COUNT(*) FROM security_events WHERE created_at >= :ts")

    dept_stmt = (
        select(
            Department.id.label("dept_id"),
            Department.name.label("dept_name"),
            Department.code.label("dept_code"),
            Department.is_active,
            func.count(Project.id).label("total"),
            func.sum(case((Project.status == ProjectStatus.ACTIVE,    1), else_=0)).label("active"),
            func.sum(case((Project.status == ProjectStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((Project.status == ProjectStatus.DRAFT,     1), else_=0)).label("draft"),
            func.sum(case((Project.status == ProjectStatus.ON_HOLD,   1), else_=0)).label("on_hold"),
        )
        .select_from(Department)
        .outerjoin(Project, (Project.current_department_id == Department.id) & Project.deleted_at.is_(None))
        .where(Department.deleted_at.is_(None))
        .group_by(Department.id, Department.name, Department.code, Department.is_active)
        .order_by(Department.name)
    )

    trend_stmt = (
        select(
            extract("year",  Project.created_at).label("yr"),
            extract("month", Project.created_at).label("mo"),
            func.count().label("cnt"),
        )
        .select_from(Project)
        .where(Project.deleted_at.is_(None))
        .where(Project.created_at >= six_months_ago_naive)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
    )

    recent_proj_stmt = (
        select(
            Project.id,
            Project.job_number,
            Project.title,
            Project.status,
            Project.priority,
            Project.created_at,
            Project.updated_at,
            Project.current_department_id,
            Project.created_by,
        )
        .select_from(Project)
        .where(Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
        .limit(8)
    )

    notif_stmt = (
        select(
            Notification.id,
            Notification.title,
            Notification.message,
            Notification.notification_type,
            Notification.is_read,
            Notification.created_at,
            Notification.event_type,
            Notification.route,
        )
        .select_from(Notification)
        .order_by(Notification.created_at.desc())
        .limit(10)
    )

    import asyncio
    (
        agg_res,
        user_res,
        ai_jobs_res,
        pending_reviews_res,
        kanban_tasks_res,
        security_events_res,
        dept_res,
        trend_res,
        recent_proj_res,
        notif_res,
    ) = await asyncio.gather(
        db.execute(agg_stmt),
        db.execute(user_stmt),
        db.execute(ai_jobs_stmt),
        db.execute(pending_reviews_stmt),
        db.execute(kanban_tasks_stmt),
        db.execute(security_events_stmt, {"ts": today_start_naive}),
        db.execute(dept_stmt),
        db.execute(trend_stmt),
        db.execute(recent_proj_stmt),
        db.execute(notif_stmt),
    )

    agg_row = agg_res.one()
    user_row = user_res.one()
    ai_jobs_cnt = ai_jobs_res.scalar() or 0
    pending_reviews_cnt = pending_reviews_res.scalar() or 0
    kanban_tasks_cnt = kanban_tasks_res.scalar() or 0
    security_events_cnt = security_events_res.scalar() or 0
    dept_rows = dept_res.all()
    trend_rows = trend_res.all()
    recent_proj_rows = recent_proj_res.all()
    notif_rows = notif_res.all()

    # ── Build department lookup map ────────────────────────────────────────────
    dept_id_to_name: Dict[str, str] = {
        str(r.dept_id): r.dept_name for r in dept_rows
    }

    # ── Assemble response ─────────────────────────────────────────────────────
    active_depts = sum(1 for r in dept_rows if r.is_active)

    statistics = {
        "total_rfqs":     int(agg_row.total or 0),
        "active_rfqs":    int(agg_row.active or 0),
        "completed_rfqs": int(agg_row.completed or 0),
        "draft_rfqs":     int(agg_row.draft or 0),
        "on_hold_rfqs":   int(agg_row.on_hold or 0),
        "cancelled_rfqs": int(agg_row.cancelled or 0),
        "today_rfqs":     int(agg_row.today or 0),
        "active_departments": active_depts,
        "total_users":    int(user_row.total_users or 0),
        "active_users":   int(user_row.active_users or 0),
        "ai_processing_jobs": int(ai_jobs_cnt),
        "pending_human_reviews": int(pending_reviews_cnt),
        "total_kanban_tasks": int(kanban_tasks_cnt),
        "today_security_events": int(security_events_cnt),
    }

    department_stats = [
        {
            "id":        str(r.dept_id),
            "name":      r.dept_name,
            "code":      r.dept_code,
            "total":     int(r.total or 0),
            "active":    int(r.active or 0),
            "completed": int(r.completed or 0),
            "pending":   int((r.draft or 0) + (r.on_hold or 0)),
            "is_active": bool(r.is_active),
            "color":     DEPT_COLORS.get(r.dept_name, "#6B7280"),
        }
        for r in dept_rows
    ]

    status_distribution = {
        "DRAFT":     int(agg_row.draft or 0),
        "ACTIVE":    int(agg_row.active or 0),
        "ON_HOLD":   int(agg_row.on_hold or 0),
        "COMPLETED": int(agg_row.completed or 0),
        "CANCELLED": int(agg_row.cancelled or 0),
    }

    monthly_trend = [
        {
            "month": MONTH_NAMES[int(r.mo) - 1],
            "year":  int(r.yr),
            "count": int(r.cnt),
        }
        for r in trend_rows
    ]

    recent_projects = [
        {
            "id":             str(r.id),
            "job_number":     r.job_number,
            "title":          r.title or r.job_number,
            "status":         r.status.value if hasattr(r.status, "value") else str(r.status),
            "status_display": STATUS_DISPLAY.get(
                r.status.value if hasattr(r.status, "value") else str(r.status), "new"
            ),
            "priority":       r.priority or "medium",
            "progress":       STATUS_PROGRESS.get(
                r.status.value if hasattr(r.status, "value") else str(r.status), 0
            ),
            "department":     dept_id_to_name.get(str(r.current_department_id or ""), ""),
            "created_at":     r.created_at.isoformat() if r.created_at else None,
            "updated_at":     r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in recent_proj_rows
    ]

    recent_notifications = [
        {
            "id":      str(r.id),
            "title":   r.title or "",
            "message": r.message or "",
            "type":    r.notification_type.value if hasattr(r.notification_type, "value") else str(r.notification_type),
            "is_read": bool(r.is_read),
            "route":   r.route,
            "event_type": r.event_type,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in notif_rows
    ]

    return {
        "statistics":           statistics,
        "department_stats":     department_stats,
        "status_distribution":  status_distribution,
        "monthly_trend":        monthly_trend,
        "recent_projects":      recent_projects,
        "recent_notifications": recent_notifications,
    }
