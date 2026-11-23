"""
app/services/history_service.py
─────────────────────────────────────────────────────────────────────────────
Service layer for Super Admin Activity History & Audit log operations.

Wraps HistoryRepository to provide paginated feeds, project timelines, user timelines,
activity drawer payloads, and CSV exports.
"""

from __future__ import annotations

import csv
import io
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.repositories.history_repository import HistoryRepository

logger = get_logger(__name__)


class HistoryService:
    """Business logic for Super Admin Activity History."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = HistoryRepository(session)

    async def get_history_dashboard(
        self,
        *,
        search: Optional[str] = None,
        module: Optional[str] = None,
        severity: Optional[str] = None,
        department_id: Optional[str] = None,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        date_range: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> Dict[str, Any]:
        """Returns live activity feed + dashboard card statistics."""
        skip = (page - 1) * page_size
        items, total = await self._repo.get_unified_activity_feed(
            search=search,
            module=module,
            severity=severity,
            department_id=department_id,
            user_id=user_id,
            project_id=project_id,
            date_range=date_range,
            skip=skip,
            limit=page_size,
        )
        stats = await self._repo.get_history_dashboard_stats()
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 1,
            "statistics": stats,
        }

    async def get_activity_detail(self, activity_id: str) -> Dict[str, Any]:
        """Fetch single activity details with old/new JSON diff."""
        activity = await self._repo.get_activity_by_id(activity_id)
        if not activity:
            raise HTTPException(status_code=404, detail=f"Activity '{activity_id}' not found.")
        return activity

    async def get_project_timeline(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch project lifecycle timeline."""
        return await self._repo.get_project_timeline(project_id)

    async def get_user_timeline(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch user activity timeline."""
        return await self._repo.get_user_timeline(user_id)

    async def export_history_csv(
        self,
        *,
        search: Optional[str] = None,
        module: Optional[str] = None,
        severity: Optional[str] = None,
        department_id: Optional[str] = None,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        date_range: Optional[str] = None,
    ) -> str:
        """Generate CSV formatted activity export based on current filters."""
        items, _ = await self._repo.get_unified_activity_feed(
            search=search,
            module=module,
            severity=severity,
            department_id=department_id,
            user_id=user_id,
            project_id=project_id,
            date_range=date_range,
            skip=0,
            limit=1000,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Timestamp", "Event Type", "Module", "User", "Department",
            "Job Number", "Project Title", "Severity", "Description"
        ])

        for item in items:
            writer.writerow([
                item.get("created_at") or "",
                item.get("event_type") or "",
                item.get("module") or "",
                item.get("user") or "",
                item.get("department") or "",
                item.get("job_number") or "",
                item.get("project_title") or "",
                item.get("severity") or "",
                item.get("description") or "",
            ])

        return output.getvalue()
