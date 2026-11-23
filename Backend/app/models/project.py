"""
app/models/project.py
─────────────────────────────────────────────────────────────────────────────
SQLAlchemy ORM model for the `projects` table.

Maps to the existing Supabase schema exactly — no column renames or type changes.
Enum values verified against live DB: DRAFT | ACTIVE | ON_HOLD | COMPLETED | CANCELLED
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.email import Email
    from app.models.file import File
    from app.models.drawing import Drawing


class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ON_HOLD = "ON_HOLD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Project(Base):
    __tablename__ = "projects"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Business Identity ─────────────────────────────────────────────────────
    job_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    rfq_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # FK to customers exists in the DB; omit SQLAlchemy ForeignKey() because
    # the customers table has no registered ORM model in this service.
    customer_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True
    )

    # ── Content ───────────────────────────────────────────────────────────────
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Status & Workflow ─────────────────────────────────────────────────────
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status", create_type=False),
        nullable=False,
        server_default="DRAFT",
    )
    priority: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    workflow_template_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True
    )
    # FK to departments exists in the DB; omit SQLAlchemy ForeignKey() because
    # the departments table has no registered ORM model in this service.
    current_department_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True
    )
    current_stage_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True
    )
    estimated_completion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    # ── Phase 10: Kanban auto-task setting ────────────────────────────────────
    # Added by migration 0005. True = AI pipeline auto-generates tasks for this project.
    auto_tasks_enabled: Mapped[bool] = mapped_column(nullable=False, server_default="true", default=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation", back_populates="project", lazy="selectin"
    )
    emails: Mapped[List["Email"]] = relationship(
        "Email", back_populates="project", lazy="selectin"
    )
    files: Mapped[List["File"]] = relationship(
        "File", back_populates="project", lazy="selectin"
    )
    drawings: Mapped[List["Drawing"]] = relationship(
        "Drawing", back_populates="project", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} job_number={self.job_number}>"
