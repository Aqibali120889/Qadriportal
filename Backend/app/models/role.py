"""
app/models/role.py
─────────────────────────────────────────────────────────────────────────────
ORM models for `roles`, `permissions`, and `role_permissions`.

roles.is_system = True AND roles.name = 'Super Admin' → super admin bypass.

Permissions are module:action strings (e.g. "projects:view", "emails:read").
They are stored as separate module + action columns in the DB and joined here.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    pass


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def key(self) -> str:
        """Returns 'module:action' string used in permission checks."""
        return f"{self.module}:{self.action}"

    def __repr__(self) -> str:
        return f"<Permission {self.key!r}>"


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    role_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("roles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    permission_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    permission: Mapped[Optional["Permission"]] = relationship(
        "Permission", lazy="selectin"
    )


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # is_system=True AND name='Super Admin' → super admin, bypasses dept isolation
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission", foreign_keys=[RolePermission.role_id], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name!r} is_system={self.is_system}>"
