"""
app/services/authorization_service.py
─────────────────────────────────────────────────────────────────────────────
Centralized Authorization Service — the single source of truth for all
permission and department access checks.

Every future module MUST use this service instead of implementing its own
authorization logic. Changes to the authorization model (e.g. shared projects,
cross-department viewers, temporary access grants) happen here once and
propagate everywhere automatically.

Design:
  - Stateless: receives RequestContext, performs checks, raises or returns
  - No DB calls: all data is already in the immutable RequestContext
  - Raises HTTPException (403 Forbidden) on access denial
  - All check methods follow the "assert_*" convention (raise on failure)
  - All query helpers follow the "filter_*" convention (return value for queries)

Usage in repositories:
    dept_filter = authorization_service.filter_by_department(ctx)
    # dept_filter = ctx.department_id for normal users
    # dept_filter = None for Super Admin (no filter = see everything)

Usage in services:
    authorization_service.assert_has_permission(ctx, "projects", "view")
    authorization_service.assert_department_access(ctx, project.current_department_id)
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status

from app.core.context import RequestContext
from app.core.logging import get_logger

logger = get_logger(__name__)

# Role name that has unrestricted cross-department access
_SUPER_ADMIN_ROLE = "Super Admin"


class AuthorizationService:
    """
    Stateless centralized RBAC and department isolation enforcement.

    Instantiate once and reuse across all services. Contains no state.
    """

    # ── Permission Checks ─────────────────────────────────────────────────────

    def assert_has_permission(
        self, ctx: RequestContext, module: str, action: str
    ) -> None:
        """
        Assert the requesting user has the given module:action permission.

        Super Admins bypass all permission checks.

        Raises:
            HTTPException 403 — if permission is not granted
        """
        if ctx.is_super_admin:
            return

        permission_key = f"{module}:{action}"
        if permission_key not in ctx.permissions:
            logger.warning(
                "permission_denied",
                user_id=ctx.user_id,
                department=ctx.department_code,
                permission=permission_key,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PERMISSION_DENIED",
                    "message": f"Permission '{permission_key}' is required for this action.",
                },
            )

    def has_permission(self, ctx: RequestContext, module: str, action: str) -> bool:
        """Non-raising permission check. Returns True/False."""
        if ctx.is_super_admin:
            return True
        return f"{module}:{action}" in ctx.permissions

    # ── Department Isolation ──────────────────────────────────────────────────

    def assert_department_access(
        self, ctx: RequestContext, resource_department_id: str
    ) -> None:
        """
        Assert the requesting user can access a resource owned by the given department.

        Super Admins can access all departments.
        Normal users can only access their own department's resources.

        Raises:
            HTTPException 403 — if department does not match
        """
        if ctx.is_super_admin:
            return

        if ctx.department_id != resource_department_id:
            logger.warning(
                "department_access_denied",
                user_id=ctx.user_id,
                user_department=ctx.department_id,
                resource_department=resource_department_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "DEPARTMENT_ACCESS_DENIED",
                    "message": "You do not have access to this department's resources.",
                },
            )

    def can_access_department(
        self, ctx: RequestContext, department_id: str
    ) -> bool:
        """Non-raising department access check. Returns True/False."""
        if ctx.is_super_admin:
            return True
        return ctx.department_id == department_id

    # ── Project Access ────────────────────────────────────────────────────────

    def assert_project_access(
        self, ctx: RequestContext, project_department_id: Optional[str]
    ) -> None:
        """
        Assert the user can access a project given its current_department_id.

        Super Admins, Foundry, and Cost Estimation users can access all RFQs/projects globally.

        Raises:
            HTTPException 403 — if access is denied
        """
        if ctx.is_super_admin or ctx.department_code in ("CE", "FOUNDRY") or ctx.has_permission("projects", "view"):
            return

        if project_department_id is not None and ctx.department_id != project_department_id:
            logger.warning(
                "project_access_denied",
                user_id=ctx.user_id,
                user_department=ctx.department_id,
                project_department=project_department_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "DEPARTMENT_ACCESS_DENIED",
                    "message": "You do not have access to this department's resources.",
                },
            )

    # ── Query Helpers ─────────────────────────────────────────────────────────

    def filter_by_department(self, ctx: RequestContext) -> Optional[str]:
        """
        Return the department_id filter value for strict departmental entities
        (e.g. task boards, department feeds, department-specific metrics).

        Returns:
            str  — ctx.department_id for normal users
            None — for Super Admins (unrestricted queries)
        """
        if ctx.is_super_admin:
            return None
        return ctx.department_id

    def filter_projects_by_department(self, ctx: RequestContext) -> Optional[str]:
        """
        Return the department_id filter value for RFQs and Projects queries.

        Super Admins, Foundry, and Cost Estimation users receive None (unrestricted global access to all RFQs).

        Returns:
            str  — ctx.department_id for other department users
            None — for Super Admins, CE, and Foundry users (see all RFQs globally)
        """
        if ctx.is_super_admin or ctx.department_code in ("CE", "FOUNDRY") or ctx.has_permission("projects", "view"):
            return None
        return ctx.department_id

    def get_accessible_department_ids(self, ctx: RequestContext) -> Optional[list]:
        """
        Return list of accessible department IDs or None for unrestricted.

        Super Admins, CE, and Foundry users receive None for projects/RFQs.
        """
        if ctx.is_super_admin or ctx.department_code in ("CE", "FOUNDRY") or ctx.has_permission("projects", "view"):
            return None
        return [ctx.department_id]

    # ── Super Admin ───────────────────────────────────────────────────────────

    def assert_super_admin(self, ctx: RequestContext) -> None:
        """
        Assert the requesting user is a Super Admin.

        Raises:
            HTTPException 403 — if user is not Super Admin
        """
        if not ctx.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "SUPER_ADMIN_REQUIRED",
                    "message": "This action requires Super Admin privileges.",
                },
            )

    @staticmethod
    def build_from_role(role_name: str, is_system: bool) -> bool:
        """
        Determine if a role qualifies as Super Admin.

        A role is Super Admin if it is a system role with the canonical name.
        """
        return is_system and role_name == _SUPER_ADMIN_ROLE


# Module-level singleton — stateless, safe to reuse
authorization_service = AuthorizationService()
