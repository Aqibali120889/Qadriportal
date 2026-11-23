"""
app/core/context.py
─────────────────────────────────────────────────────────────────────────────
RequestContext — the immutable per-request identity object.

Built once by the CurrentUserProvider (get_request_context dependency) and
injected into every protected endpoint. Business services receive this context
as a parameter and never decode JWTs or query user tables directly.

Design principles:
  - frozen=True: immutable after construction, prevents accidental mutation
  - permissions: frozenset for O(1) membership checks and hashability
  - is_super_admin: pre-computed flag, no need to check role name in services
  - session_id: optional — populated only when session tracking is available
  - current_project_id: optional — set by endpoints operating on a specific project
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class RequestContext:
    """
    Immutable per-request identity context.

    Every protected endpoint receives this via Depends(get_request_context).
    Every service method that needs identity receives this as a parameter.

    Permission check pattern:
        "projects:view" in ctx.permissions
        authorization_service.assert_has_permission(ctx, "projects", "view")
    """

    # ── User Identity ─────────────────────────────────────────────────────────
    user_id: str
    """UUID matching public.users.id and auth.users.id (Supabase Auth sub claim)."""

    # ── Department Workspace ──────────────────────────────────────────────────
    department_id: str
    """UUID of the department this user belongs to (from users.department_id)."""

    department_name: str
    """Human-readable department name (e.g. 'Cost Estimation', 'Foundry')."""

    department_code: str
    """Short department code (e.g. 'CE', 'FOUNDRY')."""

    # ── Role ──────────────────────────────────────────────────────────────────
    role_id: str
    """UUID of the user's assigned role."""

    role_name: str
    """Role name (e.g. 'Department Admin', 'Engineer', 'Viewer')."""

    # ── Permissions ───────────────────────────────────────────────────────────
    permissions: frozenset
    """
    Resolved permission set for this role.
    Format: frozenset of 'module:action' strings.
    Example: frozenset({'projects:view', 'emails:read', 'workspace:edit'})
    """

    # ── Access Level ──────────────────────────────────────────────────────────
    is_super_admin: bool
    """
    True if role.is_system=True AND role.name='Super Admin'.
    Super Admins bypass department isolation and see all resources.
    """

    # ── Session ───────────────────────────────────────────────────────────────
    session_id: Optional[str] = field(default=None)
    """
    UUID of the user_sessions row, if session tracking is active.
    Populated when the frontend has called POST /auth/session.
    May be None for requests before session registration.
    """

    # ── Project Context ───────────────────────────────────────────────────────
    current_project_id: Optional[str] = field(default=None)
    """
    Set by endpoints that operate on a specific project
    (e.g. GET /projects/{project_id}).
    Used by AuthorizationService to validate project-level access.
    Note: current_department_id on projects represents the department
    currently RESPONSIBLE for the project — projects travel between
    departments throughout their lifecycle.
    """

    def has_permission(self, module: str, action: str) -> bool:
        """Convenience method for inline permission checks."""
        return f"{module}:{action}" in self.permissions

    def __str__(self) -> str:
        return (
            f"RequestContext("
            f"user={self.user_id[:8]}… "
            f"dept={self.department_code} "
            f"role={self.role_name} "
            f"super_admin={self.is_super_admin})"
        )
