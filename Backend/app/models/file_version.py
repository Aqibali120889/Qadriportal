"""
app/models/file_version.py
─────────────────────────────────────────────────────────────────────────────
Maps to the existing `file_versions` table.
Phase 1 always inserts Version 1 automatically when a file is created.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.file import File


class FileVersion(Base):
    __tablename__ = "file_versions"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    file_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("files.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # ── Version Data ──────────────────────────────────────────────────────────
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    file: Mapped[Optional["File"]] = relationship("File", back_populates="versions")

    def __repr__(self) -> str:
        return f"<FileVersion id={self.id} file_id={self.file_id} version={self.version}>"
