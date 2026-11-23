"""
app/repositories/project_repository.py
─────────────────────────────────────────────────────────────────────────────
Data access layer for the `projects` table.

Responsibilities:
- Job number generation (atomic, year-scoped, sequential)
- Full project queries with eager-loaded relationships for API responses
- Paginated list queries
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project
from app.models.email import Email
from app.models.drawing import Drawing
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Project)

    # ── Job Number Generation ─────────────────────────────────────────────────

    async def generate_job_number(self, prefix: str = "RFQ") -> str:
        """
        Generate the next sequential job number for the current year.

        Format: {PREFIX}-{YEAR}-{SEQUENCE:03d}
        Example: RFQ-2026-001, RFQ-2026-002, ...

        Uses a COUNT query against the current year's projects to determine
        the next sequence number. This is safe in a low-concurrency environment.
        For high concurrency, replace with a PostgreSQL SEQUENCE.
        """
        current_year = datetime.utcnow().year
        year_prefix = f"{prefix}-{current_year}-"

        result = await self._session.execute(
            select(func.count())
            .select_from(Project)
            .where(Project.job_number.like(f"{year_prefix}%"))
        )
        count: int = result.scalar_one()
        sequence = count + 1
        return f"{year_prefix}{sequence:03d}"

    # ── Queries ───────────────────────────────────────────────────────────────

    async def get_by_job_number(self, job_number: str) -> Optional[Project]:
        """
        Look up a project by its business identifier (the RFQ number).
        Used at ingestion time to upsert instead of creating a duplicate
        project when a follow-up email arrives on the same RFQ thread.
        """
        result = await self._session.execute(
            select(Project)
            .where(Project.job_number == job_number)
            .where(Project.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_id_full(self, project_id: str) -> Optional[Project]:
        """
        Load a project with all Phase 1 relationships eagerly loaded:
        emails (with attachments and files), drawings (with files).
        """
        result = await self._session.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.deleted_at.is_(None))
            .options(
                selectinload(Project.emails).selectinload(Email.attachments),
                selectinload(Project.drawings).selectinload(Drawing.file),
                selectinload(Project.files),
            )
        )
        return result.scalar_one_or_none()

    async def get_paginated(
        self,
        skip: int = 0,
        limit: int = 20,
        department_id: Optional[str] = None,
    ) -> Tuple[List[Project], int]:
        """
        Return (projects, total_count) for the paginated list endpoint.
        Excludes soft-deleted records.

        Args:
            department_id: If provided, filters by projects.current_department_id.
                           If None (Super Admin), returns all projects.
        """
        base_filter = Project.deleted_at.is_(None)

        # Apply department isolation filter
        if department_id is not None:
            dept_condition = (Project.current_department_id == department_id) | (Project.current_department_id.is_(None))
            count_stmt = select(func.count()).select_from(Project).where(base_filter).where(dept_condition)
            data_stmt = (
                select(Project)
                .where(base_filter)
                .where(dept_condition)
                .options(
                    selectinload(Project.emails).selectinload(Email.attachments)
                )
                .order_by(Project.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
        else:
            # Super Admin — no department filter
            count_stmt = select(func.count()).select_from(Project).where(base_filter)
            data_stmt = (
                select(Project)
                .where(base_filter)
                .options(
                    selectinload(Project.emails).selectinload(Email.attachments)
                )
                .order_by(Project.created_at.desc())
                .offset(skip)
                .limit(limit)
            )

        count_result = await self._session.execute(count_stmt)
        total: int = count_result.scalar_one()

        data_result = await self._session.execute(data_stmt)
        projects = list(data_result.scalars().all())

        return projects, total

    # ── Phase 3: Dashboard Stats ──────────────────────────────────────────────

    async def get_department_stats(self, department_id: str) -> dict:
        """
        Return project counts grouped by status for the given department.

        Returns a dict:
            { "total": int, "DRAFT": int, "ACTIVE": int,
              "ON_HOLD": int, "COMPLETED": int, "CANCELLED": int }
        """
        from sqlalchemy import case, func as _func
        from app.models.project import ProjectStatus

        stmt = (
            select(
                _func.count().label("total"),
                _func.sum(
                    case((Project.status == ProjectStatus.DRAFT, 1), else_=0)
                ).label("draft"),
                _func.sum(
                    case((Project.status == ProjectStatus.ACTIVE, 1), else_=0)
                ).label("active"),
                _func.sum(
                    case((Project.status == ProjectStatus.ON_HOLD, 1), else_=0)
                ).label("on_hold"),
                _func.sum(
                    case((Project.status == ProjectStatus.COMPLETED, 1), else_=0)
                ).label("completed"),
                _func.sum(
                    case((Project.status == ProjectStatus.CANCELLED, 1), else_=0)
                ).label("cancelled"),
            )
            .select_from(Project)
            .where(Project.deleted_at.is_(None))
            .where(
                (Project.current_department_id == department_id) | (Project.current_department_id.is_(None))
            )
        )
        result = await self._session.execute(stmt)
        row = result.one()
        return {
            "total":     int(row.total or 0),
            "draft":     int(row.draft or 0),
            "active":    int(row.active or 0),
            "on_hold":   int(row.on_hold or 0),
            "completed": int(row.completed or 0),
            "cancelled": int(row.cancelled or 0),
        }

    # ── Phase 3: Kanban Tasks ─────────────────────────────────────────────────

    async def get_kanban_tasks(
        self,
        department_id: Optional[str] = None,
    ) -> List[Project]:
        """
        Return lightweight project rows for the Kanban board.
        Loads only the first email per project (for sender_email and
        attachment_count). Excludes soft-deleted and CANCELLED projects.
        Super Admin path: department_id=None returns all departments.
        """
        base_filter = [
            Project.deleted_at.is_(None),
            Project.status != "CANCELLED",
        ]
        if department_id is not None:
            base_filter.append(
                (Project.current_department_id == department_id) | (Project.current_department_id.is_(None))
            )

        stmt = (
            select(Project)
            .where(*base_filter)
            .options(
                selectinload(Project.emails).selectinload(Email.attachments),
            )
            .order_by(Project.created_at.desc())
            .limit(200)   # cap to avoid unbounded queries; UI paginates
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # ── Phase 3: Status Update (Kanban drag-and-drop) ─────────────────────────

    async def update_status(
        self,
        project_id: str,
        new_status: str,
        updated_by: Optional[str] = None,
    ) -> Optional[Project]:
        """
        Update a project's status.
        Returns the updated project or None if not found.
        """
        from sqlalchemy import update as sa_update
        from datetime import datetime as _dt

        stmt = (
            sa_update(Project)
            .where(Project.id == project_id)
            .where(Project.deleted_at.is_(None))
            .values(
                status=new_status,
                updated_at=_dt.utcnow(),
                updated_by=updated_by,
            )
            .returning(Project)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        row = result.scalar_one_or_none()
        return row
