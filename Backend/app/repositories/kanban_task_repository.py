"""
app/repositories/kanban_task_repository.py
─────────────────────────────────────────────────────────────────────────────
Phase 10 — Data access layer for kanban_tasks, task_comments, task_history.

Follows the existing BaseRepository pattern from project_repository.py.
All business rules live in task_service.py; this file is pure DB I/O.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.kanban_task import KanbanTask, TaskComment, TaskHistory, TaskStatus
from app.models.project import Project
from app.models.user import User
from app.repositories.base import BaseRepository

logger = get_logger(__name__)

# ── Status column ordering for board display ──────────────────────────────────
STATUS_ORDER = {
    TaskStatus.TODO.value:           0,
    TaskStatus.IN_PROGRESS.value:    1,
    TaskStatus.WAITING_REVIEW.value: 2,
    TaskStatus.BLOCKED.value:        3,
    TaskStatus.COMPLETED.value:      4,
    TaskStatus.CANCELLED.value:      5,
}


class KanbanTaskRepository(BaseRepository[KanbanTask]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, KanbanTask)

    # ── Board query (grouped by status) ───────────────────────────────────────

    async def get_board(
        self,
        department_id: Optional[str] = None,
        project_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
        status_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        search: Optional[str] = None,
        exclude_cancelled: bool = False,
    ) -> List[KanbanTask]:
        """
        Load tasks for the Kanban board view.
        Returns all matching tasks sorted by status_order then sort_order.
        """
        stmt = select(KanbanTask)
        conditions = []

        if department_id:
            conditions.append(KanbanTask.department_id == department_id)
        if project_id:
            conditions.append(KanbanTask.project_id == project_id)
        if assigned_to:
            conditions.append(KanbanTask.assigned_to == assigned_to)
        if status_filter:
            conditions.append(KanbanTask.status == status_filter)
        if priority_filter:
            conditions.append(KanbanTask.priority == priority_filter)
        if exclude_cancelled:
            conditions.append(KanbanTask.status != TaskStatus.CANCELLED.value)
        if search:
            q = f"%{search.lower()}%"
            conditions.append(
                or_(
                    func.lower(KanbanTask.title).like(q),
                    func.lower(KanbanTask.description).like(q),
                )
            )

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(KanbanTask.sort_order, KanbanTask.created_at.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # ── Single task ───────────────────────────────────────────────────────────

    async def get_by_id(self, task_id: str) -> Optional[KanbanTask]:
        result = await self._session.execute(
            select(KanbanTask).where(KanbanTask.id == task_id)
        )
        return result.scalar_one_or_none()

    # ── Enrichment helpers (join users + projects) ────────────────────────────

    async def enrich_task(self, task: KanbanTask) -> Dict[str, Any]:
        """
        Return a dict of extra fields by joining users and projects.
        Called once per task — efficient for single task detail.
        """
        extra: Dict[str, Any] = {}

        # Project RFQ number + title
        proj_row = await self._session.execute(
            select(Project.rfq_number, Project.title, Project.job_number)
            .where(Project.id == task.project_id)
        )
        proj = proj_row.first()
        if proj:
            extra["rfq_number"]    = proj.rfq_number or proj.job_number
            extra["project_title"] = proj.title or proj.job_number

        # Assignee
        if task.assigned_to:
            user_row = await self._session.execute(
                select(User.first_name, User.last_name, User.email)
                .where(User.id == task.assigned_to)
            )
            u = user_row.first()
            if u:
                extra["assignee_name"]  = f"{u.first_name or ''} {u.last_name or ''}".strip()
                extra["assignee_email"] = u.email

        # Creator
        if task.created_by:
            creator_row = await self._session.execute(
                select(User.first_name, User.last_name)
                .where(User.id == task.created_by)
            )
            c = creator_row.first()
            if c:
                extra["creator_name"] = f"{c.first_name or ''} {c.last_name or ''}".strip()

        # Comment count
        cnt = await self._session.execute(
            select(func.count()).where(TaskComment.task_id == task.id)
        )
        extra["comments_count"] = cnt.scalar_one() or 0

        return extra

    async def enrich_tasks_bulk(self, tasks: List[KanbanTask]) -> Dict[str, Dict[str, Any]]:
        """
        Bulk enrichment for board view. Single query per table.
        Returns dict: task_id → extra fields dict.
        """
        if not tasks:
            return {}

        task_ids    = [t.id for t in tasks]
        project_ids = list({t.project_id for t in tasks})
        user_ids    = list({t.assigned_to for t in tasks if t.assigned_to})

        # Projects
        proj_map: Dict[str, Any] = {}
        if project_ids:
            rows = await self._session.execute(
                select(Project.id, Project.rfq_number, Project.title, Project.job_number)
                .where(Project.id.in_(project_ids))
            )
            for r in rows:
                proj_map[r.id] = {
                    "rfq_number":    r.rfq_number or r.job_number,
                    "project_title": r.title or r.job_number,
                }

        # Users (assignees)
        user_map: Dict[str, str] = {}
        if user_ids:
            rows = await self._session.execute(
                select(User.id, User.first_name, User.last_name, User.email)
                .where(User.id.in_(user_ids))
            )
            for r in rows:
                user_map[r.id] = f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email or "?"

        # Comment counts
        comment_rows = await self._session.execute(
            select(TaskComment.task_id, func.count().label("cnt"))
            .where(TaskComment.task_id.in_(task_ids))
            .group_by(TaskComment.task_id)
        )
        comment_map: Dict[str, int] = {r.task_id: r.cnt for r in comment_rows}

        # Assemble
        result: Dict[str, Dict[str, Any]] = {}
        for t in tasks:
            extra: Dict[str, Any] = {
                "comments_count": comment_map.get(t.id, 0),
                **proj_map.get(t.project_id, {}),
            }
            if t.assigned_to:
                extra["assignee_name"] = user_map.get(t.assigned_to, "")
            result[t.id] = extra

        return result

    # ── Mutations ─────────────────────────────────────────────────────────────

    async def create_task(self, task: KanbanTask) -> KanbanTask:
        self._session.add(task)
        await self._session.flush()
        await self._session.refresh(task)
        return task

    async def update_status(self, task_id: str, new_status: str) -> None:
        now = datetime.now(timezone.utc)
        values: Dict[str, Any] = {"status": new_status, "updated_at": now}
        if new_status == TaskStatus.COMPLETED.value:
            values["completed_at"] = now
        elif new_status == TaskStatus.TODO.value:
            values["completed_at"] = None

        await self._session.execute(
            update(KanbanTask)
            .where(KanbanTask.id == task_id)
            .values(**values)
        )

    async def update_task(self, task_id: str, fields: Dict[str, Any]) -> None:
        fields["updated_at"] = datetime.now(timezone.utc)
        await self._session.execute(
            update(KanbanTask).where(KanbanTask.id == task_id).values(**fields)
        )

    async def update_assignment(self, task_id: str, assigned_to: Optional[str], assigned_by: str) -> None:
        await self._session.execute(
            update(KanbanTask)
            .where(KanbanTask.id == task_id)
            .values(
                assigned_to=assigned_to,
                assigned_by=assigned_by,
                updated_at=datetime.now(timezone.utc),
            )
        )

    # ── Comments ──────────────────────────────────────────────────────────────

    async def add_comment(self, comment: TaskComment) -> TaskComment:
        self._session.add(comment)
        await self._session.flush()
        await self._session.refresh(comment)
        return comment

    async def get_comments(self, task_id: str) -> List[TaskComment]:
        result = await self._session.execute(
            select(TaskComment)
            .where(TaskComment.task_id == task_id)
            .order_by(TaskComment.created_at.asc())
        )
        return list(result.scalars().all())

    async def enrich_comments(self, comments: List[TaskComment]) -> List[Dict[str, Any]]:
        user_ids = list({c.user_id for c in comments if c.user_id})
        user_map: Dict[str, Dict[str, str]] = {}
        if user_ids:
            rows = await self._session.execute(
                select(User.id, User.first_name, User.last_name, User.email)
                .where(User.id.in_(user_ids))
            )
            for r in rows:
                user_map[r.id] = {
                    "author_name":  f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email or "?",
                    "author_email": r.email or "",
                }
        enriched = []
        for c in comments:
            d = {
                "id": c.id, "task_id": c.task_id, "user_id": c.user_id,
                "department_id": c.department_id, "content": c.content,
                "created_at": c.created_at, "updated_at": c.updated_at,
                **user_map.get(c.user_id or "", {}),
            }
            enriched.append(d)
        return enriched

    # ── History ───────────────────────────────────────────────────────────────

    async def add_history(self, entry: TaskHistory) -> TaskHistory:
        self._session.add(entry)
        await self._session.flush()
        return entry

    async def get_history(self, task_id: str) -> List[TaskHistory]:
        result = await self._session.execute(
            select(TaskHistory)
            .where(TaskHistory.task_id == task_id)
            .order_by(TaskHistory.created_at.asc())
        )
        return list(result.scalars().all())

    async def enrich_history(self, entries: List[TaskHistory]) -> List[Dict[str, Any]]:
        user_ids = list({e.user_id for e in entries if e.user_id})
        user_map: Dict[str, str] = {}
        if user_ids:
            rows = await self._session.execute(
                select(User.id, User.first_name, User.last_name, User.email)
                .where(User.id.in_(user_ids))
            )
            for r in rows:
                user_map[r.id] = f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email or "?"
        enriched = []
        for e in entries:
            meta = e.metadata_ if hasattr(e, "metadata_") else getattr(e, "metadata", None)
            enriched.append({
                "id": e.id, "task_id": e.task_id, "user_id": e.user_id,
                "event_type": e.event_type, "old_value": e.old_value,
                "new_value": e.new_value, "metadata": meta,
                "created_at": e.created_at,
                "actor_name": user_map.get(e.user_id or "", "System"),
            })
        return enriched

    # ── Overdue detection ─────────────────────────────────────────────────────

    async def get_overdue(self, department_id: Optional[str] = None) -> List[KanbanTask]:
        today = date.today()
        conditions = [
            KanbanTask.due_date < today,
            KanbanTask.status.notin_([TaskStatus.COMPLETED.value, TaskStatus.CANCELLED.value]),
        ]
        if department_id:
            conditions.append(KanbanTask.department_id == department_id)
        result = await self._session.execute(
            select(KanbanTask).where(and_(*conditions))
        )
        return list(result.scalars().all())

    # ── Department user list (for assignment dropdown) ────────────────────────

    async def get_dept_users(self, department_id: str) -> List[User]:
        result = await self._session.execute(
            select(User)
            .where(User.department_id == department_id)
            .where(User.is_active.is_(True))
            .where(User.deleted_at.is_(None))
            .order_by(User.first_name)
        )
        return list(result.scalars().all())

    # ── Auto-task check ───────────────────────────────────────────────────────

    async def project_auto_tasks_enabled(self, project_id: str) -> bool:
        """Check if the project has auto_tasks_enabled = true."""
        from app.models.project import Project as ProjModel
        row = await self._session.execute(
            select(ProjModel.auto_tasks_enabled).where(ProjModel.id == project_id)
        )
        val = row.scalar_one_or_none()
        return bool(val) if val is not None else True
