"""
app/repositories/notification_repository.py
─────────────────────────────────────────────────────────────────────────────
Data access layer for the `notifications` table (Phase 9 Notification Center).

Visibility rule, applied consistently across every query here:
  - department-scoped: department_id = :dept_filter OR department_id IS NULL
    (dept_filter is None for Super Admin — see authorization_service.filter_by_department)
  - user-targeted notifications (user_id IS NOT NULL) are only visible to that
    user, even for Super Admin — a notification aimed at one person's session
    shouldn't leak into everyone else's dropdown just because they can see the
    department's broadcast notifications.

rfq_number is joined from `projects` at read time rather than duplicated onto
the notifications table.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.project import Project
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Notification)

    @staticmethod
    def _visibility_filters(department_id: Optional[str], user_id: str):
        """Shared WHERE clauses for department scoping + per-user targeting."""
        filters = [or_(Notification.user_id.is_(None), Notification.user_id == user_id)]
        if department_id is not None:
            filters.append(or_(Notification.department_id == department_id, Notification.department_id.is_(None)))
        return filters

    async def get_paginated(
        self,
        department_id: Optional[str],
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> Tuple[List[dict], int]:
        """Return (items, total) — each item already carries the joined rfq_number."""
        filters = self._visibility_filters(department_id, user_id)
        if unread_only:
            filters.append(Notification.is_read.is_(False))

        count_stmt = select(func.count()).select_from(Notification).where(*filters)
        total = (await self._session.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Notification, Project.rfq_number)
            .outerjoin(Project, Project.id == Notification.project_id)
            .where(*filters)
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        rows = (await self._session.execute(data_stmt)).all()

        items = []
        for notif, rfq_number in rows:
            items.append({
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
                "created_at": notif.created_at,
                "read_at": notif.read_at,
            })
        return items, total

    async def count_unread(self, department_id: Optional[str], user_id: str) -> int:
        filters = self._visibility_filters(department_id, user_id)
        filters.append(Notification.is_read.is_(False))
        stmt = select(func.count()).select_from(Notification).where(*filters)
        return (await self._session.execute(stmt)).scalar_one()

    async def mark_read(self, notification_id: str, department_id: Optional[str], user_id: str) -> Optional[Notification]:
        """Mark one notification read. Returns None if not found or not visible to this user."""
        filters = self._visibility_filters(department_id, user_id)
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, *filters)
            .values(is_read=True, read_at=datetime.now(timezone.utc).replace(tzinfo=None))
            .returning(Notification)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.scalar_one_or_none()

    async def mark_all_read(self, department_id: Optional[str], user_id: str) -> int:
        """Mark every visible unread notification read. Returns the count updated."""
        filters = self._visibility_filters(department_id, user_id)
        filters.append(Notification.is_read.is_(False))
        stmt = (
            update(Notification)
            .where(*filters)
            .values(is_read=True, read_at=datetime.now(timezone.utc).replace(tzinfo=None))
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount or 0
