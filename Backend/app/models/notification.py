"""
app/models/notification.py
─────────────────────────────────────────────────────────────────────────────
ORM model for the `notifications` table.

After Phase 2 migration (0002_phase2_identity.py), the table gains:
  department_id UUID NULL REFERENCES departments(id)

After Phase 9 migration (0004_phase9_notifications.py), the table gains:
  event_type VARCHAR(100) NULL  — specific event kind, drives icon + routing
  route      VARCHAR(500) NULL  — precomputed frontend navigation target
  read_at    TIMESTAMPTZ  NULL  — when marked read
  metadata   JSONB        NULL  — optional structured payload

notification_type enum: INFO | SUCCESS | WARNING | ERROR | TASK
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotificationType(str, enum.Enum):
    """Mirrors the notification_type enum in the live DB."""
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ERROR = "ERROR"
    TASK = "TASK"


class Notification(Base):
    __tablename__ = "notifications"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Ownership ─────────────────────────────────────────────────────────────
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True, index=True
    )
    # department_id added by 0002_phase2_identity migration
    department_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True, index=True
    )

    # ── Content ───────────────────────────────────────────────────────────────
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type", create_type=False),
        nullable=False,
        server_default="INFO",
    )

    # ── Routing / Classification (Phase 9) ───────────────────────────────────
    event_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    route: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    read_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    def __repr__(self) -> str:
        return f"<Notification id={self.id} type={self.notification_type} is_read={self.is_read}>"
