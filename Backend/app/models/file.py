"""
app/models/file.py
─────────────────────────────────────────────────────────────────────────────
Maps to the existing `files` table.
Stores only metadata — binary content lives in Supabase Storage.

Enums verified against live DB:
  file_status: UPLOADING | AVAILABLE | PROCESSING | ARCHIVED | DELETED
  file_type:   PDF | DWG | DXF | STEP | IMAGE | XLSX | DOCX | ZIP | OTHER
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.file_version import FileVersion


class FileStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    AVAILABLE = "AVAILABLE"
    PROCESSING = "PROCESSING"
    ARCHIVED = "ARCHIVED"
    DELETED = "DELETED"


class FileType(str, enum.Enum):
    PDF = "PDF"
    DWG = "DWG"
    DXF = "DXF"
    STEP = "STEP"
    IMAGE = "IMAGE"
    XLSX = "XLSX"
    DOCX = "DOCX"
    ZIP = "ZIP"
    OTHER = "OTHER"


class File(Base):
    __tablename__ = "files"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    category_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    # ── File Identity ─────────────────────────────────────────────────────────
    file_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_type: Mapped[Optional[FileType]] = mapped_column(
        Enum(FileType, name="file_type", create_type=False), nullable=True
    )
    mime_type: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # ── Storage ───────────────────────────────────────────────────────────────
    storage_provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # ── Versioning ────────────────────────────────────────────────────────────
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    status: Mapped[FileStatus] = mapped_column(
        Enum(FileStatus, name="file_status", create_type=False),
        nullable=False,
        server_default="UPLOADING",
    )

    # ── Audit ─────────────────────────────────────────────────────────────────
    uploaded_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="files")
    versions: Mapped[list["FileVersion"]] = relationship(
        "FileVersion", back_populates="file", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<File id={self.id} original_name={self.original_name!r} status={self.status}>"
