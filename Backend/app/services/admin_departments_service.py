"""
app/services/admin_departments_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 11.2 — Super Admin department aggregation service.

Provides:
  get_departments_list() — paginated dept list with live aggregated stats
  get_department_detail() — full dept detail with members, projects, tasks, activity

All queries are aggregated server-side. No N+1. No mock data.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.department import Department
from app.models.kanban_task import KanbanTask
from app.models.notification import Notification
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserStatus

logger = get_logger(__name__)

# ── dept colour palette (matches frontend) ────────────────────────────────────
DEPT_COLORS: Dict[str, str] = {
    "Marketing":        "#8B5CF6",
    "Cost Estimation":  "#3B82F6",
    "Foundry":          "#F59E0B",
    "QEN":              "#10B981",
    "Fabrication":      "#EF4444",
    "Admin":            "#F5821F",
    "Reports":          "#6366F1",
}


def _dept_color(name: str) -> str:
    return DEPT_COLORS.get(name, "#6B7280")


# ── Departments List ──────────────────────────────────────────────────────────

async def get_departments_list(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort: str = "name_asc",
    page: int = 1,
    page_size: int = 20,
) -> Dict[str, Any]:
    """
    Return paginated department list with live stats:
      - user_count    (users.department_id = dept.id, not deleted)
      - active/pending/completed/total project counts
      - open_task_count (kanban_tasks.department_id = dept.id, status != completed/cancelled)
      - unread_notification_count
      - manager_name (joined from users)
    """

    conditions = [Department.deleted_at.is_(None)]

    if search:
        q = f"%{search.strip()}%"
        conditions.append(
            or_(Department.name.ilike(q), Department.code.ilike(q))
        )
    if is_active is not None:
        conditions.append(Department.is_active == is_active)

    # ── Sort ─────────────────────────────────────────────────────────────────
    sort_map = {
        "name_asc":     Department.name.asc(),
        "name_desc":    Department.name.desc(),
        "created_asc":  Department.created_at.asc(),
        "created_desc": Department.created_at.desc(),
    }
    order_col = sort_map.get(sort, Department.name.asc())

    # ── Count ─────────────────────────────────────────────────────────────────
    count_stmt = select(func.count()).select_from(Department).where(*conditions)
    total: int = (await db.execute(count_stmt)).scalar_one()

    skip = (page - 1) * page_size

    # ── Main data query ───────────────────────────────────────────────────────
    # Manager name subquery
    Manager = User.__table__.alias("mgr")

    data_stmt = (
        select(
            Department.id,
            Department.name,
            Department.code,
            Department.description,
            Department.manager_id,
            Department.is_active,
            Department.created_at,
        )
        .where(*conditions)
        .order_by(order_col)
        .offset(skip)
        .limit(page_size)
    )
    dept_rows = (await db.execute(data_stmt)).all()

    if not dept_rows:
        return {"items": [], "total": total, "page": page, "page_size": page_size, "pages": 1}

    dept_ids = [str(r.id) for r in dept_rows]
    manager_ids = [r.manager_id for r in dept_rows if r.manager_id]

    # ── Manager names in one query ────────────────────────────────────────────
    mgr_map: Dict[str, str] = {}
    if manager_ids:
        mgr_stmt = select(User.id, User.first_name, User.last_name, User.email).where(
            User.id.in_(manager_ids), User.deleted_at.is_(None)
        )
        mgr_rows = (await db.execute(mgr_stmt)).all()
        for r in mgr_rows:
            full = f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email
            mgr_map[str(r.id)] = full

    # ── User counts per dept ──────────────────────────────────────────────────
    uc_stmt = (
        select(User.department_id, func.count().label("cnt"))
        .where(User.department_id.in_(dept_ids), User.deleted_at.is_(None))
        .group_by(User.department_id)
    )
    uc_map: Dict[str, int] = {
        str(r.department_id): int(r.cnt)
        for r in (await db.execute(uc_stmt)).all()
    }

    # ── Project counts per dept (by current_department_id) ───────────────────
    pc_stmt = (
        select(
            Project.current_department_id,
            func.count().label("total"),
            func.sum(case((Project.status == ProjectStatus.ACTIVE,    1), else_=0)).label("active"),
            func.sum(case((Project.status == ProjectStatus.DRAFT,     1), else_=0)).label("draft"),
            func.sum(case((Project.status == ProjectStatus.ON_HOLD,   1), else_=0)).label("on_hold"),
            func.sum(case((Project.status == ProjectStatus.COMPLETED, 1), else_=0)).label("completed"),
        )
        .where(
            Project.current_department_id.in_(dept_ids),
            Project.deleted_at.is_(None),
        )
        .group_by(Project.current_department_id)
    )
    pc_map: Dict[str, Dict[str, int]] = {}
    for r in (await db.execute(pc_stmt)).all():
        pc_map[str(r.current_department_id)] = {
            "total":     int(r.total or 0),
            "active":    int(r.active or 0),
            "pending":   int((r.draft or 0) + (r.on_hold or 0)),
            "completed": int(r.completed or 0),
        }

    # ── Open task count per dept ──────────────────────────────────────────────
    tc_stmt = (
        select(KanbanTask.department_id, func.count().label("cnt"))
        .where(
            KanbanTask.department_id.in_(dept_ids),
            KanbanTask.status.notin_(["completed", "cancelled"]),
        )
        .group_by(KanbanTask.department_id)
    )
    tc_map: Dict[str, int] = {
        str(r.department_id): int(r.cnt)
        for r in (await db.execute(tc_stmt)).all()
    }

    # ── Unread notification count per dept ────────────────────────────────────
    nc_stmt = (
        select(Notification.department_id, func.count().label("cnt"))
        .where(
            Notification.department_id.in_(dept_ids),
            Notification.is_read == False,  # noqa: E712
        )
        .group_by(Notification.department_id)
    )
    nc_map: Dict[str, int] = {
        str(r.department_id): int(r.cnt)
        for r in (await db.execute(nc_stmt)).all()
    }

    # ── Assemble items ────────────────────────────────────────────────────────
    items = []
    for r in dept_rows:
        did = str(r.id)
        pc = pc_map.get(did, {"total": 0, "active": 0, "pending": 0, "completed": 0})
        items.append({
            "id":                 did,
            "name":               r.name,
            "code":               r.code,
            "description":        r.description or "",
            "color":              _dept_color(r.name),
            "is_active":          bool(r.is_active),
            "manager_id":         str(r.manager_id) if r.manager_id else None,
            "manager_name":       mgr_map.get(str(r.manager_id), "") if r.manager_id else "",
            "user_count":         uc_map.get(did, 0),
            "active_projects":    pc["active"],
            "pending_projects":   pc["pending"],
            "completed_projects": pc["completed"],
            "total_projects":     pc["total"],
            "open_tasks":         tc_map.get(did, 0),
            "unread_notifications": nc_map.get(did, 0),
            "created_at":         r.created_at.isoformat() if r.created_at else None,
        })

    pages = (total + page_size - 1) // page_size if total else 1
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


# ── Department Detail ─────────────────────────────────────────────────────────

async def get_department_detail(db: AsyncSession, dept_id: str) -> Optional[Dict[str, Any]]:
    """
    Return full department detail for the side drawer.
    Fetches: base info, assigned users, recent projects, task stats, recent activity.
    """

    # ── Base dept row ─────────────────────────────────────────────────────────
    dept_stmt = select(Department).where(
        Department.id == dept_id, Department.deleted_at.is_(None)
    )
    dept = (await db.execute(dept_stmt)).scalar_one_or_none()
    if not dept:
        return None

    # ── Manager name ──────────────────────────────────────────────────────────
    manager_name = ""
    if dept.manager_id:
        m_stmt = select(User.first_name, User.last_name, User.email).where(User.id == dept.manager_id)
        m_row = (await db.execute(m_stmt)).first()
        if m_row:
            manager_name = f"{m_row.first_name or ''} {m_row.last_name or ''}".strip() or m_row.email

    # ── Assigned users ────────────────────────────────────────────────────────
    from app.models.role import Role
    users_stmt = (
        select(
            User.id, User.first_name, User.last_name, User.email,
            User.status, User.is_active, User.last_login,
            Role.name.label("role_name"),
        )
        .select_from(User)
        .outerjoin(Role, Role.id == User.role_id)
        .where(User.department_id == dept_id, User.deleted_at.is_(None))
        .order_by(User.first_name.asc())
        .limit(20)
    )
    user_rows = (await db.execute(users_stmt)).all()
    members = [
        {
            "id":        str(r.id),
            "name":      f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email,
            "email":     r.email,
            "role":      r.role_name or "—",
            "status":    r.status.value if hasattr(r.status, "value") else str(r.status),
            "is_active": bool(r.is_active),
            "last_login": r.last_login.isoformat() if r.last_login else None,
            "is_head":   dept.manager_id and str(r.id) == str(dept.manager_id),
        }
        for r in user_rows
    ]

    # ── Recent projects ───────────────────────────────────────────────────────
    proj_stmt = (
        select(
            Project.id, Project.job_number, Project.title,
            Project.status, Project.priority, Project.updated_at,
        )
        .where(Project.current_department_id == dept_id, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc())
        .limit(5)
    )
    proj_rows = (await db.execute(proj_stmt)).all()
    recent_projects = [
        {
            "id":         str(r.id),
            "job_number": r.job_number,
            "title":      r.title or r.job_number,
            "status":     r.status.value if hasattr(r.status, "value") else str(r.status),
            "priority":   r.priority or "medium",
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in proj_rows
    ]

    # ── Task stats by status ──────────────────────────────────────────────────
    tk_stmt = (
        select(KanbanTask.status, func.count().label("cnt"))
        .where(KanbanTask.department_id == dept_id)
        .group_by(KanbanTask.status)
    )
    tk_rows = (await db.execute(tk_stmt)).all()
    task_stats = {r.status: int(r.cnt) for r in tk_rows}

    # ── Recent notifications (dept inbox) ─────────────────────────────────────
    notif_stmt = (
        select(
            Notification.id, Notification.title, Notification.message,
            Notification.notification_type, Notification.is_read, Notification.created_at,
        )
        .where(Notification.department_id == dept_id)
        .order_by(Notification.created_at.desc())
        .limit(5)
    )
    notif_rows = (await db.execute(notif_stmt)).all()
    notifications = [
        {
            "id":      str(r.id),
            "title":   r.title or "",
            "message": r.message or "",
            "type":    r.notification_type.value if hasattr(r.notification_type, "value") else str(r.notification_type),
            "is_read": bool(r.is_read),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in notif_rows
    ]

    return {
        "id":           str(dept.id),
        "name":         dept.name,
        "code":         dept.code,
        "description":  dept.description or "",
        "color":        _dept_color(dept.name),
        "is_active":    bool(dept.is_active),
        "manager_id":   str(dept.manager_id) if dept.manager_id else None,
        "manager_name": manager_name,
        "created_at":   dept.created_at.isoformat() if dept.created_at else None,
        "members":      members,
        "recent_projects": recent_projects,
        "task_stats":   task_stats,
        "notifications": notifications,
    }
