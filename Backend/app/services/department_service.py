"""
app/services/department_service.py
─────────────────────────────────────────────────────────────────────────────
Service layer for Department Management operations.

Wraps DepartmentRepository and handles validations, audit logging, system events,
and business rules.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.logging import get_logger
from app.models.department import Department
from app.repositories.department_repository import DepartmentRepository
from app.services.admin_departments_service import get_department_detail, get_departments_list

logger = get_logger(__name__)


class DepartmentService:
    """Business logic for enterprise Department Management."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = DepartmentRepository(session)

    async def list_departments(
        self,
        *,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort: str = "name_asc",
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Fetch paginated departments with live aggregated stats."""
        return await get_departments_list(
            self._session, search=search, is_active=is_active, sort=sort, page=page, page_size=page_size
        )

    async def get_department_detail(self, dept_id: str) -> Dict[str, Any]:
        """Fetch department detail drawer payload."""
        detail = await get_department_detail(self._session, dept_id)
        if not detail:
            raise HTTPException(status_code=404, detail=f"Department '{dept_id}' not found.")
        return detail

    async def get_department_analytics(self, dept_id: str) -> Dict[str, Any]:
        """Calculate department analytics metrics."""
        dept = await self._repo.get_by_id(dept_id)
        if not dept or dept.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"Department '{dept_id}' not found.")
        return await self._repo.get_department_analytics(dept_id)

    async def create_department(
        self,
        name: str,
        code: str,
        description: Optional[str] = None,
        manager_id: Optional[str] = None,
        ctx: Optional[RequestContext] = None,
    ) -> Department:
        """Create a new department with uniqueness validation."""
        name = name.strip()
        code = code.strip().upper()

        if not name or not code:
            raise HTTPException(status_code=422, detail="Department name and code are required.")

        # Check duplicate code
        existing_code = await self._repo.get_by_code(code)
        if existing_code:
            raise HTTPException(status_code=409, detail=f"Department code '{code}' already exists.")

        # Check duplicate name
        existing_name = await self._repo.get_by_name(name)
        if existing_name:
            raise HTTPException(status_code=409, detail=f"Department name '{name}' already exists.")

        creator_id = ctx.user_id if ctx else None
        dept = Department(
            name=name,
            code=code,
            description=description or None,
            manager_id=manager_id or None,
            is_active=True,
            created_by=creator_id,
            updated_by=creator_id,
        )
        await self._repo.add(dept)
        await self._session.flush()

        # Audit log & System Event
        try:
            await self._session.execute(
                text("""
                    INSERT INTO system_events (module, entity_name, entity_id, event_type, description, performed_by, severity)
                    VALUES ('departments', 'Department', :eid, 'CREATED', :desc, :by, 'INFO')
                """),
                {
                    "eid": dept.id,
                    "desc": f"Department '{dept.name}' ({dept.code}) created.",
                    "by": creator_id,
                }
            )
        except Exception:
            pass  # Non-blocking event recording

        await self._session.commit()
        logger.info("department_created", dept_id=dept.id, code=dept.code)
        return dept

    async def update_department(
        self,
        dept_id: str,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        manager_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        ctx: Optional[RequestContext] = None,
    ) -> Department:
        """Update department fields."""
        dept = await self._repo.get_by_id(dept_id)
        if not dept or dept.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"Department '{dept_id}' not found.")

        if name is not None:
            clean_name = name.strip()
            if clean_name and clean_name.lower() != dept.name.lower():
                existing = await self._repo.get_by_name(clean_name)
                if existing and existing.id != dept_id:
                    raise HTTPException(status_code=409, detail=f"Department name '{clean_name}' already exists.")
                dept.name = clean_name

        if description is not None:
            dept.description = description
        if manager_id is not None:
            dept.manager_id = manager_id if manager_id else None
        if is_active is not None:
            dept.is_active = is_active

        if ctx:
            dept.updated_by = ctx.user_id

        await self._session.commit()
        await self._session.refresh(dept)
        logger.info("department_updated", dept_id=dept.id)
        return dept

    async def archive_department(self, dept_id: str, ctx: RequestContext) -> None:
        """Archive (soft delete) a department."""
        dept = await self._repo.get_by_id(dept_id)
        if not dept or dept.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"Department '{dept_id}' not found.")

        archived = await self._repo.archive_department(dept_id, ctx.user_id)
        if not archived:
            raise HTTPException(status_code=400, detail="Department could not be archived.")

        await self._session.commit()
        logger.info("department_archived", dept_id=dept_id, by=ctx.user_id)
