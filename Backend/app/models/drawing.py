"""
app/models/drawing.py
─────────────────────────────────────────────────────────────────────────────
Maps to the existing `drawings` table.
Each drawing links a project to its uploaded engineering PDF file.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.file import File


class Drawing(Base):
    __tablename__ = "drawings"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    file_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )

    # ── Drawing Metadata ──────────────────────────────────────────────────────
    drawing_number: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    drawing_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    revision: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    material: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    drawing_scale: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    units: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    total_pages: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="drawings")
    file: Mapped[Optional["File"]] = relationship("File", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Drawing id={self.id} title={self.drawing_title!r}>"
