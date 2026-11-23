"""
app/models/user.py
─────────────────────────────────────────────────────────────────────────────
ORM model for the `users` table.

users.department_id → departments.id  (direct single-department membership)
users.role_id       → roles.id

Enum user_status: ACTIVE | INVITED | INACTIVE | LOCKED
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.role import Role
    from app.models.user_session import UserSession


class UserStatus(str, enum.Enum):
    """Mirrors the user_status enum in the live DB."""
    ACTIVE = "ACTIVE"
    INVITED = "INVITED"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"


class User(Base):
    __tablename__ = "users"

    # ── Primary Key ───────────────────────────────────────────────────────────
    # id matches auth.users.id (Supabase Auth). Sub claim in JWT = this id.
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Profile ───────────────────────────────────────────────────────────────
    employee_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(500), nullable=False, unique=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Department & Role ─────────────────────────────────────────────────────
    # FK to departments: direct single-department membership.
    # department_members table does not exist — users.department_id is the FK.
    department_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    role_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    manager_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    # ── Account Status ────────────────────────────────────────────────────────
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", create_type=False),
        nullable=False,
        server_default="INVITED",
    )
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    # ── Relationships (lazy so they don't auto-load everywhere) ───────────────
    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        foreign_keys=[department_id],
        primaryjoin="User.department_id == Department.id",
        lazy="selectin",
    )
    role: Mapped[Optional["Role"]] = relationship(
        "Role",
        foreign_keys=[role_id],
        primaryjoin="User.role_id == Role.id",
        lazy="selectin",
    )
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        foreign_keys="UserSession.user_id",
        primaryjoin="User.id == UserSession.user_id",
        lazy="noload",
    )

    @property
    def full_name(self) -> str:
        parts = [self.first_name or "", self.last_name or ""]
        return " ".join(p for p in parts if p).strip() or self.email

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} status={self.status}>"
