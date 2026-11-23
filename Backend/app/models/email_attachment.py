"""
app/models/email_attachment.py
─────────────────────────────────────────────────────────────────────────────
Maps to the existing `email_attachments` table.
Records the attachment name, size and the linked file record.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.email import Email
    from app.models.file import File


class EmailAttachment(Base):
    __tablename__ = "email_attachments"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    email_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("emails.id", ondelete="CASCADE"), nullable=True, index=True
    )
    file_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )

    # ── Metadata ──────────────────────────────────────────────────────────────
    attachment_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    attachment_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    email: Mapped[Optional["Email"]] = relationship("Email", back_populates="attachments")
    file: Mapped[Optional["File"]] = relationship("File", lazy="selectin")

    def __repr__(self) -> str:
        return f"<EmailAttachment id={self.id} name={self.attachment_name!r}>"
