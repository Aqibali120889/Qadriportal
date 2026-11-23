"""
app/models/conversation.py
─────────────────────────────────────────────────────────────────────────────
Maps to the existing `conversations` table.
Enum: conversation_type → CUSTOMER | INTERNAL | VENDOR
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.email import Email


class ConversationType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    INTERNAL = "INTERNAL"
    VENDOR = "VENDOR"


class Conversation(Base):
    __tablename__ = "conversations"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # ── Content ───────────────────────────────────────────────────────────────
    conversation_type: Mapped[ConversationType] = mapped_column(
        Enum(ConversationType, name="conversation_type", create_type=False),
        nullable=False,
        server_default="CUSTOMER",
    )
    subject: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    initiated_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="conversations")
    emails: Mapped[List["Email"]] = relationship(
        "Email", back_populates="conversation", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} project_id={self.project_id}>"
