"""
app/models/login_history.py
─────────────────────────────────────────────────────────────────────────────
ORM model for the pre-existing `login_history` table.

Phase 11.2 — read-only model used by the Admin Users detail endpoint to
surface login history in the User drawer without N+1 queries.

login_status enum: SUCCESS | FAILED | LOCKED (USER-DEFINED in DB)
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LoginHistory(Base):
    __tablename__ = "login_history"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True, index=True
    )
    email: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    operating_system: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    login_status: Mapped[str] = mapped_column(String(50), nullable=False)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    login_time: Mapped[datetime] = mapped_column(nullable=False)

    def __repr__(self) -> str:
        return f"<LoginHistory id={self.id} user_id={self.user_id} status={self.login_status}>"
