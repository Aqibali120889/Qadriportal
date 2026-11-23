"""
app/services/admin_users_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 11.2 — Super Admin user management service.

Provides:
  get_users_list() — paginated, searchable, filterable user list
  get_user_detail() — full user detail with sessions, login history,
                      assigned projects, tasks, permissions
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.department import Department
from app.models.kanban_task import KanbanTask
from app.models.login_history import LoginHistory
from app.models.notification import Notification
from app.models.project import Project, ProjectStatus
from app.models.role import Permission, Role, RolePermission
from app.models.user import User, UserStatus
from app.models.user_session import UserSession, SessionStatus

logger = get_logger(__name__)

# ── Avatar colour from initials ───────────────────────────────────────────────
_AVATAR_COLORS = [
    "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
    "#EF4444", "#F5821F", "#6366F1", "#06B6D4",
]

def _avatar_color(user_id: str) -> str:
    """Deterministic colour from user_id hash."""
    try:
        n = int(user_id.replace("-", "")[:8], 16)
    except (ValueError, AttributeError):
        n = 0
    return _AVATAR_COLORS[n % len(_AVATAR_COLORS)]

def _initials(first: Optional[str], last: Optional[str], email: str) -> str:
    parts = [(first or "")[:1].upper(), (last or "")[:1].upper()]
    result = "".join(p for p in parts if p)
    return result or email[:2].upper()


# ── Users List ────────────────────────────────────────────────────────────────

async def get_users_list(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    department_id: Optional[str] = None,
    role_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort: str = "name_asc",
    page: int = 1,
    page_size: int = 20,
) -> Dict[str, Any]:
    """
    Paginated user list enriched with department name, role name, active session flag.
    One additional subquery provides assigned_project_count per user.
    """

    conditions = [User.deleted_at.is_(None)]

    if search:
        q = f"%{search.strip()}%"
        conditions.append(
            or_(
                User.first_name.ilike(q),
                User.last_name.ilike(q),
                User.email.ilike(q),
                User.employee_id.ilike(q),
            )
        )
    if department_id:
        conditions.append(User.department_id == department_id)
    if role_id:
        conditions.append(User.role_id == role_id)
    if status_filter:
        try:
            st = UserStatus(status_filter.upper())
            conditions.append(User.status == st)
        except ValueError:
            pass

    # ── Sort ─────────────────────────────────────────────────────────────────
    sort_map = {
        "name_asc":       User.first_name.asc(),
        "name_desc":      User.first_name.desc(),
        "email_asc":      User.email.asc(),
        "created_desc":   User.created_at.desc(),
        "created_asc":    User.created_at.asc(),
        "last_login_desc": User.last_login.desc().nullslast(),
    }
    order_col = sort_map.get(sort, User.first_name.asc())

    # ── Count ─────────────────────────────────────────────────────────────────
    count_stmt = select(func.count()).select_from(User).where(*conditions)
    total: int = (await db.execute(count_stmt)).scalar_one()

    skip = (page - 1) * page_size

    # ── Data query with dept + role joins ─────────────────────────────────────
    data_stmt = (
        select(
            User.id,
            User.employee_id,
            User.first_name,
            User.last_name,
            User.email,
            User.phone,
            User.avatar_url,
            User.status,
            User.is_active,
            User.last_login,
            User.created_at,
            User.department_id,
            User.role_id,
            Department.name.label("dept_name"),
            Department.code.label("dept_code"),
            Role.name.label("role_name"),
        )
        .select_from(User)
        .outerjoin(Department, Department.id == User.department_id)
        .outerjoin(Role, Role.id == User.role_id)
        .where(*conditions)
        .order_by(order_col)
        .offset(skip)
        .limit(page_size)
    )
    rows = (await db.execute(data_stmt)).all()

    if not rows:
        pages = (total + page_size - 1) // page_size if total else 1
        return {"items": [], "total": total, "page": page, "page_size": page_size, "pages": pages}

    user_uuids = [r.id for r in rows]

    # ── Execute subqueries concurrently ─────────────────────────────────────
    sess_stmt = (
        select(UserSession.user_id)
        .where(
            UserSession.user_id.in_(user_uuids),
            UserSession.status == SessionStatus.ACTIVE,
        )
        .distinct()
    )
    proj_count_stmt = (
        select(Project.created_by, func.count().label("cnt"))
        .where(Project.created_by.in_(user_uuids), Project.deleted_at.is_(None))
        .group_by(Project.created_by)
    )
    task_count_stmt = (
        select(KanbanTask.assigned_to, func.count().label("cnt"))
        .where(
            KanbanTask.assigned_to.in_(user_uuids),
            KanbanTask.status.notin_(["completed", "cancelled"]),
        )
        .group_by(KanbanTask.assigned_to)
    )

    import asyncio
    sess_res, proj_res, task_res = await asyncio.gather(
        db.execute(sess_stmt),
        db.execute(proj_count_stmt),
        db.execute(task_count_stmt),
    )

    active_session_user_ids = {str(r.user_id) for r in sess_res.all()}
    proj_count_map: Dict[str, int] = {str(r.created_by): int(r.cnt) for r in proj_res.all()}
    task_count_map: Dict[str, int] = {str(r.assigned_to): int(r.cnt) for r in task_res.all()}

    # ── Assemble ──────────────────────────────────────────────────────────────
    items = []
    for r in rows:
        uid = str(r.id)
        items.append({
            "id":               uid,
            "employee_id":      r.employee_id,
            "first_name":       r.first_name or "",
            "last_name":        r.last_name or "",
            "full_name":        f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email,
            "initials":         _initials(r.first_name, r.last_name, r.email),
            "avatar_color":     _avatar_color(uid),
            "avatar_url":       r.avatar_url,
            "email":            r.email,
            "phone":            r.phone,
            "status":           r.status.value if hasattr(r.status, "value") else str(r.status),
            "is_active":        bool(r.is_active),
            "department_id":    str(r.department_id) if r.department_id else None,
            "department_name":  r.dept_name or "—",
            "department_code":  r.dept_code or "",
            "role_id":          str(r.role_id) if r.role_id else None,
            "role_name":        r.role_name or "—",
            "last_login":       r.last_login.isoformat() if r.last_login else None,
            "created_at":       r.created_at.isoformat() if r.created_at else None,
            "active_session":   uid in active_session_user_ids,
            "assigned_projects": proj_count_map.get(uid, 0),
            "open_tasks":       task_count_map.get(uid, 0),
        })

    pages = (total + page_size - 1) // page_size if total else 1
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


# ── User Detail ───────────────────────────────────────────────────────────────

async def get_user_detail(db: AsyncSession, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Return full user detail for the drawer.
    Fetches: profile, sessions, login history, projects, tasks, permissions.
    """

    # ── Base user ─────────────────────────────────────────────────────────────
    user_stmt = (
        select(
            User.id, User.employee_id, User.first_name, User.last_name,
            User.email, User.phone, User.avatar_url, User.status, User.is_active,
            User.last_login, User.created_at, User.department_id, User.role_id,
            User.mfa_enabled, User.email_verified,
            Department.name.label("dept_name"),
            Department.code.label("dept_code"),
            Role.id.label("r_id"),
            Role.name.label("role_name"),
            Role.description.label("role_desc"),
            Role.is_system,
        )
        .select_from(User)
        .outerjoin(Department, Department.id == User.department_id)
        .outerjoin(Role, Role.id == User.role_id)
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    row = (await db.execute(user_stmt)).first()
    if not row:
        return None

    uid = str(row.id)

    # ── Active sessions ───────────────────────────────────────────────────────
    sess_stmt = (
        select(UserSession)
        .where(UserSession.user_id == uid, UserSession.status == SessionStatus.ACTIVE)
        .order_by(UserSession.created_at.desc())
        .limit(5)
    )
    sess_rows = (await db.execute(sess_stmt)).scalars().all()
    sessions = [
        {
            "id":               str(s.id),
            "ip_address":       s.ip_address,
            "device":           s.device,
            "browser":          s.browser,
            "operating_system": s.operating_system,
            "status":           s.status.value if hasattr(s.status, "value") else str(s.status),
            "created_at":       s.created_at.isoformat() if s.created_at else None,
        }
        for s in sess_rows
    ]

    # ── Login history ─────────────────────────────────────────────────────────
    lh_stmt = (
        select(LoginHistory)
        .where(LoginHistory.user_id == uid)
        .order_by(LoginHistory.login_time.desc())
        .limit(10)
    )
    lh_rows = (await db.execute(lh_stmt)).scalars().all()
    login_history = [
        {
            "id":               str(lh.id),
            "ip_address":       lh.ip_address,
            "browser":          lh.browser,
            "operating_system": lh.operating_system,
            "login_status":     lh.login_status,
            "failure_reason":   lh.failure_reason,
            "login_time":       lh.login_time.isoformat() if lh.login_time else None,
        }
        for lh in lh_rows
    ]

    # ── Assigned projects ─────────────────────────────────────────────────────
    proj_stmt = (
        select(Project.id, Project.job_number, Project.title, Project.status, Project.updated_at)
        .where(Project.created_by == uid, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc())
        .limit(5)
    )
    proj_rows = (await db.execute(proj_stmt)).all()
    assigned_projects = [
        {
            "id":         str(r.id),
            "job_number": r.job_number,
            "title":      r.title or r.job_number,
            "status":     r.status.value if hasattr(r.status, "value") else str(r.status),
        }
        for r in proj_rows
    ]

    # ── Open tasks ────────────────────────────────────────────────────────────
    task_stmt = (
        select(KanbanTask.id, KanbanTask.title, KanbanTask.status, KanbanTask.priority, KanbanTask.due_date)
        .where(
            KanbanTask.assigned_to == uid,
            KanbanTask.status.notin_(["completed", "cancelled"]),
        )
        .order_by(KanbanTask.due_date.asc().nullslast())
        .limit(10)
    )
    task_rows = (await db.execute(task_stmt)).all()
    open_tasks = [
        {
            "id":       str(r.id),
            "title":    r.title,
            "status":   r.status,
            "priority": r.priority,
            "due_date": r.due_date.isoformat() if r.due_date else None,
        }
        for r in task_rows
    ]

    # ── Role permissions ──────────────────────────────────────────────────────
    permissions: List[str] = []
    if row.role_id:
        perm_stmt = (
            select(Permission.module, Permission.action, Permission.description)
            .select_from(RolePermission)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(RolePermission.role_id == str(row.role_id))
        )
        perm_rows = (await db.execute(perm_stmt)).all()
        permissions = [f"{p.module}:{p.action}" for p in perm_rows]

    return {
        "id":               uid,
        "employee_id":      row.employee_id,
        "full_name":        f"{row.first_name or ''} {row.last_name or ''}".strip() or row.email,
        "first_name":       row.first_name or "",
        "last_name":        row.last_name or "",
        "initials":         _initials(row.first_name, row.last_name, row.email),
        "avatar_color":     _avatar_color(uid),
        "avatar_url":       row.avatar_url,
        "email":            row.email,
        "phone":            row.phone,
        "status":           row.status.value if hasattr(row.status, "value") else str(row.status),
        "is_active":        bool(row.is_active),
        "email_verified":   bool(row.email_verified),
        "mfa_enabled":      bool(row.mfa_enabled),
        "last_login":       row.last_login.isoformat() if row.last_login else None,
        "created_at":       row.created_at.isoformat() if row.created_at else None,
        "department_id":    str(row.department_id) if row.department_id else None,
        "department_name":  row.dept_name or "—",
        "department_code":  row.dept_code or "",
        "role_id":          str(row.r_id) if row.r_id else None,
        "role_name":        row.role_name or "—",
        "role_description": row.role_desc or "",
        "is_super_admin":   bool(row.is_system),
        "permissions":      permissions,
        "sessions":         sessions,
        "login_history":    login_history,
        "assigned_projects": assigned_projects,
        "open_tasks":       open_tasks,
    }
