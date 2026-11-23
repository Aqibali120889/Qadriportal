"""
app/models/user_session.py
─────────────────────────────────────────────────────────────────────────────
ORM model for the `user_sessions` table.

Phase 2 uses this table for session TRACKING ONLY.
- No refresh_token is stored by this backend.
- Authentication and token refresh are handled entirely by Supabase Auth.
- This record is created when the frontend calls POST /auth/session after
  a successful Supabase login, providing device/browser/IP metadata.
- Marked REVOKED when the frontend calls DELETE /auth/session/{id}.

session_status enum: ACTIVE | EXPIRED | REVOKED
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class SessionStatus(str, enum.Enum):
    """Mirrors the session_status enum in the live DB."""
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class UserSession(Base):
    __tablename__ = "user_sessions"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── User Reference ────────────────────────────────────────────────────────
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # ── Device Metadata ───────────────────────────────────────────────────────
    # Provided by the frontend after Supabase login for session tracking.
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    operating_system: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    expires_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", create_type=False),
        nullable=False,
        server_default="ACTIVE",
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    # ── Relationship ──────────────────────────────────────────────────────────
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="sessions",
        foreign_keys=[user_id],
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<UserSession id={self.id} user_id={self.user_id} status={self.status}>"
