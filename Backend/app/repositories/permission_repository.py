"""
app/repositories/permission_repository.py
─────────────────────────────────────────────────────────────────────────────
Repository for resolving permissions for a given role.

Permission resolution:
  roles.id → role_permissions.role_id → permissions.id → module + action

Permissions are returned as a frozenset of "module:action" strings
for O(1) lookup in the RequestContext and AuthorizationService.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Permission, RolePermission


class PermissionRepository:
    """Resolves the permission set for a given role."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_permissions_for_role(self, role_id: str) -> frozenset:
        """
        Return all permissions assigned to a role as a frozenset of
        'module:action' strings.

        Example return value:
            frozenset({'projects:view', 'emails:read', 'workspace:edit'})

        This is the authoritative permission set stored in RequestContext.
        All AuthorizationService checks operate against this frozenset.

        Performance note:
            roles and permissions tables are small and indexed.
            No caching layer is needed at this scale.
            This query runs once per request and returns quickly.
        """
        stmt = (
            select(Permission.module, Permission.action)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )
        result = await self._session.execute(stmt)
        rows = result.all()
        return frozenset(f"{row.module}:{row.action}" for row in rows)
