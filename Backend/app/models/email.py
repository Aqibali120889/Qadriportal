"""
app/models/email.py
─────────────────────────────────────────────────────────────────────────────
Maps to the existing `emails` table.
Enum: email_status  → RECEIVED | SENT | DRAFT | FAILED
Enum: email_folder  → INBOX | SENT | DRAFTS | DELETED | ARCHIVE (DB-defined)
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.conversation import Conversation
    from app.models.email_attachment import EmailAttachment


class EmailStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    SENT = "SENT"
    DRAFT = "DRAFT"
    FAILED = "FAILED"


class EmailFolder(str, enum.Enum):
    """Mirrors the email_folder enum in the live Supabase DB."""
    INBOX = "INBOX"
    SENT = "SENT"
    DRAFTS = "DRAFTS"
    DELETED = "DELETED"
    ARCHIVE = "ARCHIVE"
    JUNK = "JUNK"
    OUTBOX = "OUTBOX"


class Email(Base):
    __tablename__ = "emails"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    conversation_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── Outlook Identifiers ───────────────────────────────────────────────────
    outlook_message_id: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, unique=True, index=True
    )
    internet_message_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── Email Content ─────────────────────────────────────────────────────────
    subject: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sender_email: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)

    # ── Status & Timestamps ───────────────────────────────────────────────────
    # folder is of type email_folder (DB enum); nullable — left NULL on ingest
    # to avoid hard-coding enum values that may differ across environments.
    folder: Mapped[Optional[str]] = mapped_column(
        Enum("INBOX", "SENT", "DRAFTS", "DELETED", "ARCHIVE", "JUNK", "OUTBOX",
             name="email_folder", create_type=False),
        nullable=True,
    )
    status: Mapped[EmailStatus] = mapped_column(
        Enum(EmailStatus, name="email_status", create_type=False),
        nullable=False,
        server_default="RECEIVED",
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="emails")
    conversation: Mapped[Optional["Conversation"]] = relationship(
        "Conversation", back_populates="emails"
    )
    attachments: Mapped[List["EmailAttachment"]] = relationship(
        "EmailAttachment", back_populates="email", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Email id={self.id} subject={self.subject!r}>"
