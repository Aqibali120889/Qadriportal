"""
app/models/kanban_task.py
─────────────────────────────────────────────────────────────────────────────
Phase 10 — ORM models for the enterprise Kanban task management system.

Three tables:
  - KanbanTask     : the core task entity (linked to a project)
  - TaskComment    : threaded comment on a task
  - TaskHistory    : immutable audit log of every task mutation
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.department import Department
    from app.models.project import Project


class TaskStatus(str, enum.Enum):
    TODO            = "todo"
    IN_PROGRESS     = "in_progress"
    WAITING_REVIEW  = "waiting_review"
    BLOCKED         = "blocked"
    COMPLETED       = "completed"
    CANCELLED       = "cancelled"


class TaskPriority(str, enum.Enum):
    CRITICAL = "critical"
    HIGH     = "high"
    MEDIUM   = "medium"
    LOW      = "low"


class TaskEventType(str, enum.Enum):
    CREATED         = "created"
    ASSIGNED        = "assigned"
    UNASSIGNED      = "unassigned"
    STATUS_CHANGED  = "status_changed"
    PRIORITY_CHANGED = "priority_changed"
    COMMENT_ADDED   = "comment_added"
    DUE_DATE_CHANGED = "due_date_changed"
    TITLE_CHANGED   = "title_changed"
    COMPLETED       = "completed"
    REOPENED        = "reopened"
    CANCELLED       = "cancelled"
    AI_GENERATED    = "ai_generated"


class KanbanTask(Base):
    __tablename__ = "kanban_tasks"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── FK Relationships ──────────────────────────────────────────────────────
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # ── Content ───────────────────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    task_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # ── Status & Priority ─────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=TaskStatus.TODO.value
    )
    priority: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=TaskPriority.MEDIUM.value
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # ── Assignment ────────────────────────────────────────────────────────────
    assigned_to: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ── Scheduling ────────────────────────────────────────────────────────────
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estimated_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # ── Flags ─────────────────────────────────────────────────────────────────
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Child Relationships ───────────────────────────────────────────────────
    comments: Mapped[List["TaskComment"]] = relationship(
        "TaskComment", back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    history: Mapped[List["TaskHistory"]] = relationship(
        "TaskHistory", back_populates="task", cascade="all, delete-orphan", lazy="selectin",
        order_by="TaskHistory.created_at"
    )

    def __repr__(self) -> str:
        return f"<KanbanTask id={self.id} status={self.status} title={self.title[:30]}>"


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("kanban_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    department_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    task: Mapped["KanbanTask"] = relationship("KanbanTask", back_populates="comments")

    def __repr__(self) -> str:
        return f"<TaskComment id={self.id} task_id={self.task_id}>"


class TaskHistory(Base):
    __tablename__ = "task_history"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("kanban_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    task: Mapped["KanbanTask"] = relationship("KanbanTask", back_populates="history")

    def __repr__(self) -> str:
        return f"<TaskHistory id={self.id} event={self.event_type}>"

