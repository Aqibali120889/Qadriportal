"""
app/api/v1/admin.py
─────────────────────────────────────────────────────────────────────────────
Phase 11 — Super Admin API.

All routes require Super Admin role (is_super_admin=True on RequestContext).
Normal department users receive 403.

Phase 11.1 routes:
  GET /api/v1/admin/dashboard
  GET /api/v1/admin/projects
  GET /api/v1/admin/customers

Phase 11.2 routes:
  GET    /api/v1/admin/departments
  GET    /api/v1/admin/departments/{id}
  POST   /api/v1/admin/departments
  PATCH  /api/v1/admin/departments/{id}
  DELETE /api/v1/admin/departments/{id}

  GET    /api/v1/admin/users
  GET    /api/v1/admin/users/{id}
  POST   /api/v1/admin/users
  PATCH  /api/v1/admin/users/{id}
  DELETE /api/v1/admin/users/{id}

  GET    /api/v1/admin/roles   — list for filter dropdowns
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.config import get_settings
from app.core.context import RequestContext
from app.core.logging import get_logger

settings = get_settings()
from app.models.customer import Customer
from app.models.department import Department
from app.models.project import Project, ProjectStatus
from app.models.role import Role
from app.models.user import User, UserStatus
from app.services.admin_dashboard_service import (
    STATUS_DISPLAY,
    STATUS_PROGRESS,
    DEPT_COLORS,
    get_dashboard_data,
)
from app.services.admin_departments_service import (
    get_departments_list,
    get_department_detail,
)
from app.services.admin_users_service import (
    get_users_list,
    get_user_detail,
)
from app.services.department_service import DepartmentService
from app.services.user_management_service import UserManagementService
from app.services.history_service import HistoryService
from app.services.settings_service import SettingsService

logger = get_logger(__name__)

router = APIRouter(
    prefix="/admin",
    tags=["Super Admin"],
)


# ── Guard helper ──────────────────────────────────────────────────────────────

def _require_super_admin(ctx: RequestContext) -> None:
    if not ctx.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required.",
        )


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get(
    "/dashboard",
    summary="Super Admin Dashboard",
    description=(
        "Returns the complete dashboard payload: KPI statistics, department workloads, "
        "status distribution, monthly trend, recent projects, and recent notifications. "
        "Super Admin only. All aggregation is server-side."
    ),
)
async def get_dashboard(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    logger.info("admin_dashboard_requested", user_id=ctx.user_id)
    return await get_dashboard_data(db)


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get(
    "/projects",
    summary="Admin Projects List",
    description=(
        "Returns paginated projects for Super Admin. "
        "Supports search (job_number, title), status filter, department filter, sort. "
        "Joins customers and departments for enriched display."
    ),
)
async def list_admin_projects(
    page:          int            = Query(default=1, ge=1),
    page_size:     int            = Query(default=20, ge=1, le=100),
    search:        Optional[str]  = Query(default=None, description="Search job_number or title"),
    status_filter: Optional[str]  = Query(default=None, alias="status", description="DRAFT|ACTIVE|ON_HOLD|COMPLETED|CANCELLED"),
    department_id: Optional[str]  = Query(default=None, description="Filter by department UUID"),
    sort:          str            = Query(default="created_at_desc", description="created_at_desc|created_at_asc|updated_at_desc|job_number_asc"),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)

    # ── Base query ─────────────────────────────────────────────────────────────
    base = Project.deleted_at.is_(None)
    conditions = [base]

    if search:
        q = f"%{search.strip()}%"
        conditions.append(
            or_(
                Project.job_number.ilike(q),
                Project.title.ilike(q),
                Project.rfq_number.ilike(q),
            )
        )

    if status_filter:
        try:
            ps = ProjectStatus(status_filter.upper())
            conditions.append(Project.status == ps)
        except ValueError:
            pass  # ignore invalid status

    if department_id:
        conditions.append(Project.current_department_id == department_id)

    # ── Sort ───────────────────────────────────────────────────────────────────
    sort_map = {
        "created_at_desc":  Project.created_at.desc(),
        "created_at_asc":   Project.created_at.asc(),
        "updated_at_desc":  Project.updated_at.desc(),
        "job_number_asc":   Project.job_number.asc(),
    }
    order_col = sort_map.get(sort, Project.created_at.desc())

    skip = (page - 1) * page_size

    # ── Count ──────────────────────────────────────────────────────────────────
    count_stmt = (
        select(func.count())
        .select_from(Project)
        .where(*conditions)
    )
    total: int = (await db.execute(count_stmt)).scalar_one()

    # ── Data (with customer + department join) ─────────────────────────────────
    data_stmt = (
        select(
            Project.id,
            Project.job_number,
            Project.rfq_number,
            Project.title,
            Project.status,
            Project.priority,
            Project.created_at,
            Project.updated_at,
            Project.current_department_id,
            Project.customer_id,
            Project.created_by,
            # Customer columns (LEFT JOIN) — real schema uses company_name
            Customer.company_name.label("customer_name"),
            Customer.contact_person.label("contact_person"),
            Customer.email.label("customer_email"),
            # Department name (LEFT JOIN)
            Department.name.label("dept_name"),
            Department.code.label("dept_code"),
        )
        .select_from(Project)
        .outerjoin(Customer, Customer.id == Project.customer_id)
        .outerjoin(Department, Department.id == Project.current_department_id)
        .where(*conditions)
        .order_by(order_col)
        .offset(skip)
        .limit(page_size)
    )
    rows = (await db.execute(data_stmt)).all()

    items = [
        {
            "id":             str(r.id),
            "job_number":     r.job_number,
            "rfq_number":     r.rfq_number,
            "title":          r.title or r.job_number,
            "status":         r.status.value if hasattr(r.status, "value") else str(r.status),
            "status_display": STATUS_DISPLAY.get(
                r.status.value if hasattr(r.status, "value") else str(r.status), "new"
            ),
            "priority":       r.priority or "medium",
            "progress":       STATUS_PROGRESS.get(
                r.status.value if hasattr(r.status, "value") else str(r.status), 0
            ),
            "customer_id":    str(r.customer_id) if r.customer_id else None,
            "customer_name":  r.customer_name,
            "contact_person": r.contact_person,
            "customer_email": r.customer_email,
            "department_id":  str(r.current_department_id) if r.current_department_id else None,
            "department":     r.dept_name or "",
            "dept_code":      r.dept_code or "",
            "dept_color":     DEPT_COLORS.get(r.dept_name or "", "#6B7280"),
            "created_by":     str(r.created_by) if r.created_by else None,
            "created_at":     r.created_at.isoformat() if r.created_at else None,
            "updated_at":     r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]

    pages = (total + page_size - 1) // page_size if total else 1

    logger.info(
        "admin_projects_listed",
        user_id=ctx.user_id,
        page=page,
        total=total,
        search=search,
        status_filter=status_filter,
    )

    return {
        "items":     items,
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     pages,
    }


# ── Customers ─────────────────────────────────────────────────────────────────

@router.get(
    "/customers",
    summary="Customer List",
    description="Returns paginated customer list. Super Admin only.",
)
async def list_customers(
    page:      int           = Query(default=1, ge=1),
    page_size: int           = Query(default=20, ge=1, le=100),
    search:    Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)

    conditions = [Customer.deleted_at.is_(None)]
    if search:
        q = f"%{search.strip()}%"
        conditions.append(
            or_(Customer.company_name.ilike(q), Customer.email.ilike(q), Customer.contact_person.ilike(q))
        )

    count_stmt = select(func.count()).select_from(Customer).where(*conditions)
    total: int = (await db.execute(count_stmt)).scalar_one()

    data_stmt = (
        select(Customer)
        .where(*conditions)
        .order_by(Customer.company_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(data_stmt)).scalars().all()

    return {
        "items": [
            {
                "id":             str(c.id),
                "company_name":   c.company_name,
                "contact_person": c.contact_person,
                "email":          c.email,
                "phone":          c.phone,
                "city":           c.city,
                "country":        c.country,
                "notes":          c.notes,
                "created_at":     c.created_at.isoformat() if c.created_at else None,
            }
            for c in rows
        ],
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     (total + page_size - 1) // page_size if total else 1,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 11.2 — DEPARTMENTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/departments",
    summary="Admin Departments List",
    description=(
        "Paginated department list with live stats: user count, project counts, "
        "open task count, unread notifications, manager name. Super Admin only."
    ),
)
async def list_departments(
    page:       int            = Query(default=1, ge=1),
    page_size:  int            = Query(default=50, ge=1, le=200),
    search:     Optional[str]  = Query(default=None),
    is_active:  Optional[bool] = Query(default=None),
    sort:       str            = Query(default="name_asc"),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    result = await get_departments_list(
        db, search=search, is_active=is_active, sort=sort, page=page, page_size=page_size
    )
    logger.info("admin_departments_listed", user_id=ctx.user_id, total=result["total"])
    return result


@router.get(
    "/departments/{dept_id}",
    summary="Admin Department Detail",
    description="Full department detail: members, recent projects, task stats, notifications.",
)
async def get_department(
    dept_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    detail = await get_department_detail(db, dept_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    return detail


@router.post(
    "/departments",
    summary="Create Department",
    status_code=201,
)
async def create_department(
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)

    name        = (payload.get("name") or "").strip()
    code        = (payload.get("code") or "").strip().upper()
    description = payload.get("description", "")
    manager_id  = payload.get("manager_id")

    if not name or not code:
        raise HTTPException(status_code=422, detail="name and code are required.")

    # Ensure code is unique
    existing = (await db.execute(
        select(Department).where(Department.code == code, Department.deleted_at.is_(None))
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Department code '{code}' already exists.")

    dept = Department(
        name=name,
        code=code,
        description=description or None,
        manager_id=manager_id or None,
        is_active=True,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    db.add(dept)
    await db.flush()
    await db.refresh(dept)

    # Audit log
    from app.models.kanban_task import KanbanTask  # local to avoid circular
    from sqlalchemy import text as _text
    try:
        await db.execute(_text("""
            INSERT INTO entity_audit_logs (entity_name, entity_id, operation, new_data, changed_by, changed_at)
            VALUES ('departments', :eid, 'INSERT', :data, :by, now())
        """), {"eid": dept.id, "data": f'{{"name":"{dept.name}","code":"{dept.code}"}}', "by": ctx.user_id})
    except Exception:
        pass  # audit failure must never block business operation

    await db.commit()

    logger.info("admin_department_created", dept_id=dept.id, name=dept.name, by=ctx.user_id)
    return {
        "id":          str(dept.id),
        "name":        dept.name,
        "code":        dept.code,
        "description": dept.description,
        "is_active":   dept.is_active,
        "manager_id":  str(dept.manager_id) if dept.manager_id else None,
    }


@router.patch(
    "/departments/{dept_id}",
    summary="Update Department",
)
async def update_department(
    dept_id: str,
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)

    dept = (await db.execute(
        select(Department).where(Department.id == dept_id, Department.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    if "name"        in payload: dept.name        = payload["name"].strip()
    if "description" in payload: dept.description = payload["description"]
    if "is_active"   in payload: dept.is_active   = bool(payload["is_active"])
    if "manager_id"  in payload: dept.manager_id  = payload["manager_id"] or None
    dept.updated_by = ctx.user_id
    dept.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(dept)
    logger.info("admin_department_updated", dept_id=dept.id, by=ctx.user_id)
    return {"id": str(dept.id), "name": dept.name, "is_active": dept.is_active}


@router.delete(
    "/departments/{dept_id}",
    summary="Soft-delete Department",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_department(
    dept_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_super_admin(ctx)

    dept = (await db.execute(
        select(Department).where(Department.id == dept_id, Department.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    # Check: departments with active users cannot be deleted
    user_count = (await db.execute(
        select(func.count()).select_from(User).where(
            User.department_id == dept_id, User.deleted_at.is_(None)
        )
    )).scalar_one()
    if user_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {user_count} user(s) still assigned to this department.",
        )

    dept.deleted_at = datetime.utcnow()
    dept.is_active  = False
    dept.updated_by = ctx.user_id
    await db.commit()
    logger.info("admin_department_soft_deleted", dept_id=dept_id, by=ctx.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 11.2 — USERS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/users",
    summary="Admin Users List",
    description=(
        "Paginated user list with live stats: dept, role, last login, active session, "
        "assigned project count, open task count. Supports search, dept/role/status filter, sort."
    ),
)
async def list_users(
    page:          int            = Query(default=1, ge=1),
    page_size:     int            = Query(default=20, ge=1, le=100),
    search:        Optional[str]  = Query(default=None),
    department_id: Optional[str]  = Query(default=None),
    role_id:       Optional[str]  = Query(default=None),
    status_filter: Optional[str]  = Query(default=None, alias="status"),
    sort:          str            = Query(default="name_asc"),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    result = await get_users_list(
        db,
        search=search,
        department_id=department_id,
        role_id=role_id,
        status_filter=status_filter,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    logger.info("admin_users_listed", user_id=ctx.user_id, total=result["total"])
    return result


@router.get(
    "/users/{user_id}",
    summary="Admin User Detail",
    description="Full user detail: profile, sessions, login history, assigned projects/tasks, permissions.",
)
async def get_user(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    detail = await get_user_detail(db, user_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return detail


@router.post(
    "/users",
    summary="Create / Invite User",
    status_code=201,
)
async def create_user(
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Invite a new user to the platform.

    Phase 2C: Calls Supabase Admin API to create auth.users record and send
    the invitation email. The returned UUID is used as public.users.id so that
    auth.users.id == public.users.id at all times.

    Requires Super Admin role.
    """
    _require_super_admin(ctx)

    email       = (payload.get("email") or "").strip().lower()
    first_name  = (payload.get("first_name") or "").strip() or None
    last_name   = (payload.get("last_name") or "").strip() or None
    dept_id     = payload.get("department_id") or None
    role_id     = payload.get("role_id") or None
    redirect_to = payload.get("redirect_to") or None

    if not email:
        raise HTTPException(status_code=422, detail="email is required.")

    from app.services.user_management_service import UserManagementService
    svc = UserManagementService(db)
    user = await svc.create_user(
        email=email,
        first_name=first_name,
        last_name=last_name,
        department_id=dept_id,
        role_id=role_id,
        redirect_to=redirect_to,
        ctx=ctx,
    )

    logger.info("admin_user_invited", new_user_id=user.id, email=email, by=ctx.user_id)
    return {
        "id":        str(user.id),
        "email":     user.email,
        "status":    user.status.value,
        "is_active": user.is_active,
        "message":   "Invitation email sent via Supabase Auth.",
    }


@router.patch(
    "/users/{user_id}",
    summary="Update User",
)
async def update_user(
    user_id: str,
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)

    user = (await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if "first_name"     in payload: user.first_name     = payload["first_name"] or None
    if "last_name"      in payload: user.last_name      = payload["last_name"] or None
    if "department_id"  in payload: user.department_id  = payload["department_id"] or None
    if "role_id"        in payload: user.role_id        = payload["role_id"] or None
    if "is_active"      in payload: user.is_active      = bool(payload["is_active"])
    if "status"         in payload:
        try:
            user.status = UserStatus(payload["status"].upper())
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {payload['status']}")
    user.updated_by = ctx.user_id
    user.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(user)
    logger.info("admin_user_updated", target_user_id=user_id, by=ctx.user_id)
    return {
        "id":        str(user.id),
        "status":    user.status.value,
        "is_active": user.is_active,
    }


@router.delete(
    "/users/{user_id}",
    summary="Soft-delete User",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_user(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_super_admin(ctx)

    user = (await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.deleted_at = datetime.utcnow()
    user.is_active  = False
    user.status     = UserStatus.INACTIVE
    user.updated_by = ctx.user_id
    await db.commit()
    logger.info("admin_user_soft_deleted", target_user_id=user_id, by=ctx.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 11.2 — ROLES  (dropdown helper)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/roles",
    summary="Roles List",
    description="Returns all non-deleted roles for filter dropdowns and assignment UI.",
)
async def list_roles(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    stmt = (
        select(Role.id, Role.name, Role.description, Role.is_system)
        .where(Role.deleted_at.is_(None))
        .order_by(Role.name.asc())
    )
    rows = (await db.execute(stmt)).all()
    return {
        "items": [
            {
                "id":          str(r.id),
                "name":        r.name,
                "description": r.description,
                "is_system":   bool(r.is_system),
            }
            for r in rows
        ]
    }


@router.get(
    "/departments/{dept_id}/analytics",
    summary="Department Analytics",
    description="Returns live processing metrics, project counts, AI vs human review counts, and open tasks.",
)
async def get_department_analytics(
    dept_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = DepartmentService(db)
    return await svc.get_department_analytics(dept_id)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 11.2 — USER ACTIONS & MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/users/{user_id}/lock",
    summary="Lock User Account",
)
async def lock_user_account(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    await svc.lock_user(user_id, ctx)
    return {"message": "User account locked successfully."}


@router.post(
    "/users/{user_id}/unlock",
    summary="Unlock User Account",
)
async def unlock_user_account(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    await svc.unlock_user(user_id, ctx)
    return {"message": "User account unlocked successfully."}


@router.post(
    "/users/{user_id}/deactivate",
    summary="Deactivate User Account",
)
async def deactivate_user_account(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    await svc.deactivate_user(user_id, ctx)
    return {"message": "User account deactivated successfully."}


@router.post(
    "/users/{user_id}/role",
    summary="Assign Role to User",
)
async def assign_user_role(
    user_id: str,
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    role_id = payload.get("role_id")
    await svc.assign_role(user_id, role_id, ctx)
    return {"message": "User role updated successfully."}


@router.post(
    "/users/{user_id}/department",
    summary="Assign Department to User",
)
async def assign_user_department(
    user_id: str,
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    department_id = payload.get("department_id")
    await svc.assign_department(user_id, department_id, ctx)
    return {"message": "User department updated successfully."}


@router.get(
    "/users/{user_id}/sessions",
    summary="Get User Active Sessions",
)
async def get_user_sessions(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    sessions = await svc.get_user_sessions(user_id)
    return {
        "items": [
            {
                "id": str(s.id),
                "ip_address": s.ip_address,
                "device": s.device,
                "browser": s.browser,
                "operating_system": s.operating_system,
                "status": s.status.value if hasattr(s.status, "value") else str(s.status),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ]
    }


@router.delete(
    "/users/{user_id}/sessions/{session_id}",
    summary="Terminate User Session",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def terminate_user_session(
    user_id: str,
    session_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    await svc.revoke_user_session(user_id, session_id, ctx)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/users/{user_id}/history",
    summary="Get User Login History",
)
async def get_user_history(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    history = await svc.get_user_history(user_id)
    return {
        "items": [
            {
                "id": str(h.id),
                "email": h.email,
                "ip_address": h.ip_address,
                "browser": h.browser,
                "operating_system": h.operating_system,
                "login_status": h.login_status,
                "failure_reason": h.failure_reason,
                "login_time": h.login_time.isoformat() if h.login_time else None,
            }
            for h in history
        ]
    }


@router.get(
    "/users/{user_id}/security-events",
    summary="Get User Security Events",
)
async def get_user_security_events(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = UserManagementService(db)
    events = await svc.get_user_security_events(user_id)
    return {"items": events}


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 11 — HISTORY & ENTERPRISE AUDIT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/history",
    summary="Global Activity History Feed",
    description="Unified, reverse-chronological enterprise activity feed with filters.",
)
async def list_history(
    page:          int            = Query(default=1, ge=1),
    page_size:     int            = Query(default=25, ge=1, le=100),
    search:        Optional[str]  = Query(default=None),
    module:        Optional[str]  = Query(default=None),
    severity:      Optional[str]  = Query(default=None),
    department_id: Optional[str]  = Query(default=None),
    user_id:       Optional[str]  = Query(default=None),
    project_id:    Optional[str]  = Query(default=None),
    date_range:    Optional[str]  = Query(default=None),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = HistoryService(db)
    return await svc.get_history_dashboard(
        search=search,
        module=module,
        severity=severity,
        department_id=department_id,
        user_id=user_id,
        project_id=project_id,
        date_range=date_range,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/history/export",
    summary="Export Activity History CSV",
)
async def export_history(
    search:        Optional[str]  = Query(default=None),
    module:        Optional[str]  = Query(default=None),
    severity:      Optional[str]  = Query(default=None),
    department_id: Optional[str]  = Query(default=None),
    user_id:       Optional[str]  = Query(default=None),
    project_id:    Optional[str]  = Query(default=None),
    date_range:    Optional[str]  = Query(default=None),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_super_admin(ctx)
    svc = HistoryService(db)
    csv_data = await svc.export_history_csv(
        search=search,
        module=module,
        severity=severity,
        department_id=department_id,
        user_id=user_id,
        project_id=project_id,
        date_range=date_range,
    )
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_history.csv"},
    )


@router.get(
    "/history/project/{project_id}",
    summary="Project Lifecycle Timeline",
)
async def get_project_history(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = HistoryService(db)
    items = await svc.get_project_timeline(project_id)
    return {"items": items}


@router.get(
    "/history/user/{user_id}",
    summary="User Activity Timeline",
)
async def get_user_activity_timeline(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = HistoryService(db)
    items = await svc.get_user_timeline(user_id)
    return {"items": items}


@router.get(
    "/history/{activity_id}",
    summary="Activity Detail & JSON Diff",
)
async def get_activity_detail(
    activity_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = HistoryService(db)
    return await svc.get_activity_detail(activity_id)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 11 — ENTERPRISE SETTINGS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/settings",
    summary="Get All System Settings",
)
async def get_all_settings(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.get_all_settings()


@router.get(
    "/settings/{category}",
    summary="Get Settings Category",
)
async def get_settings_category(
    category: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.get_settings_by_category(category)


@router.patch(
    "/settings/{category}",
    summary="Update Settings Category",
)
async def update_settings_category(
    category: str,
    payload: Dict[str, Any] = Body(...),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.update_category_settings(category, payload, ctx)


@router.post("/settings/test-email", summary="Test Email Integration")
async def test_email(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.test_email_connection()


@router.post("/settings/test-ai", summary="Test AI Pipeline Integration")
async def test_ai(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.test_ai_connection()


@router.post("/settings/test-storage", summary="Test Supabase Storage Bucket")
async def test_storage(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.test_storage_connection()


@router.post("/settings/test-webhook", summary="Test n8n Webhook Endpoint")
async def test_webhook(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_super_admin(ctx)
    svc = SettingsService(db)
    return await svc.test_webhook_connection()



