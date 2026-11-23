"""
app/api/deps.py
─────────────────────────────────────────────────────────────────────────────
FastAPI dependency functions for shared request-level concerns:
  - Database session (per-request)
  - Internal API key authentication (for n8n webhook)
  - CurrentUserProvider: get_request_context (Phase 2)
  - Permission dependency factories (Phase 2)
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.context import RequestContext
from app.core.jwt import decode_access_token
from app.core.logging import get_logger
from app.database import AsyncSessionLocal
from app.models.role import Role, RolePermission
from app.models.user import User, UserStatus
from app.repositories.permission_repository import PermissionRepository
from app.repositories.user_repository import UserRepository
from app.services.authorization_service import authorization_service

logger = get_logger(__name__)
settings = get_settings()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a scoped async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def verify_internal_key(
    x_internal_key: str = Header(
        ...,
        alias="X-Internal-Key",
        description="Shared secret sent by n8n to authenticate webhook calls.",
    )
) -> None:
    """
    Dependency that validates the internal API key sent by n8n.
    Raises 401 if the key is missing or does not match.
    This prevents external actors from injecting fake email payloads.
    """
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal API key. "
                   "Set the X-Internal-Key header to the configured INTERNAL_API_KEY value.",
        )


# ── CurrentUserProvider ───────────────────────────────────────────────────────

async def _build_request_context(
    authorization: Optional[str],
    x_dev_user_email: Optional[str],
    db: AsyncSession,
) -> RequestContext:
    """
    CurrentUserProvider core — resolves the authenticated request identity.

    Executes identity resolution pipeline:
        1. Extract Bearer token from Authorization header or X-Dev-User-Email header
        2. Validate JWT signature and expiry or resolve dev user in DEV_MODE
        3. Load User with Role + Department from DB
        4. Validate user.is_active and user.status (bypassed in DEV_MODE)
        5. Resolve permissions for the role
        6. Determine is_super_admin
        7. Build and return immutable RequestContext

    Shared by both get_request_context (header-based, every normal endpoint)
    and get_request_context_sse (query-param-based, the notification SSE
    stream — browser EventSource cannot send custom headers) so the identity
    resolution logic exists exactly once.

    Business services NEVER call this function directly.
    Business services NEVER decode JWTs.
    Routers NEVER manually query user information.
    Everything consumes the returned RequestContext.
    """
    user_repo = UserRepository(db)
    user = None
    user_id = None

    # Step 1 & 2: Extract & Decode token or check Dev Recovery Header
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
        payload = decode_access_token(token)
        user_id = payload.sub
        user = await user_repo.get_by_id_with_role_and_department(user_id)
    elif settings.DEV_MODE and x_dev_user_email:
        target_email = x_dev_user_email.strip().lower()
        logger.warning(
            "dev_mode_identity_override",
            requested_email=target_email,
            message="DEV_MODE=true with explicit X-Dev-User-Email header",
        )
        stmt = (
            select(User)
            .where(User.email == target_email)
            .where(User.deleted_at.is_(None))
            .options(
                selectinload(User.role).selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission),
                selectinload(User.department),
            )
        )
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

    if user is None:
        logger.warning("auth_user_not_found", user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Valid bearer token or user identity required."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Step 5: Validate account status
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "ACCOUNT_INACTIVE", "message": "This account has been deactivated."},
        )
    if user.status in (UserStatus.INACTIVE, UserStatus.LOCKED):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ACCOUNT_LOCKED" if user.status == UserStatus.LOCKED else "ACCOUNT_INACTIVE",
                "message": "This account is not authorized to access the platform.",
            },
        )

    # Step 6: Resolve permissions
    if user.role_id:
        perm_repo = PermissionRepository(db)
        permissions = await perm_repo.get_permissions_for_role(user.role_id)
    else:
        permissions = frozenset()

    # Step 7: Determine Super Admin
    role = user.role
    is_super_admin = (
        role is not None
        and authorization_service.build_from_role(role.name, role.is_system)
    )

    # Step 8: Build immutable RequestContext
    dept = user.department

    # ── DEV_MODE: allow users with no department to log in ───────────────────
    # In development, missing department assignments should not block the login
    # flow. Build a fallback context so the frontend can continue without error.
    if dept is None:
        if settings.DEV_MODE:
            logger.warning(
                "dev_mode_no_department_bypass",
                user_id=user_id,
                message="DEV_MODE=true: user has no department — using fallback context",
            )
            ctx = RequestContext(
                user_id=user.id,
                department_id="00000000-0000-0000-0000-000000000000",
                department_name="Unassigned",
                department_code="UNKNOWN",
                role_id=user.role_id or "",
                role_name=role.name if role else "",
                permissions=permissions,
                is_super_admin=is_super_admin,
                session_id=None,
            )
            return ctx
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "NO_DEPARTMENT",
                    "message": "User is not assigned to a department. Contact your administrator.",
                },
            )

    ctx = RequestContext(
        user_id=user.id,
        department_id=dept.id,
        department_name=dept.name,
        department_code=dept.code,
        role_id=user.role_id or "",
        role_name=role.name if role else "",
        permissions=permissions,
        is_super_admin=is_super_admin,
        session_id=None,  # populated by POST /auth/session flow
    )

    logger.debug(
        "request_context_resolved",
        user_id=ctx.user_id,
        department=ctx.department_code,
        role=ctx.role_name,
        is_super_admin=ctx.is_super_admin,
    )

    return ctx


async def get_request_context(
    authorization: Optional[str] = Header(
        default=None,
        alias="Authorization",
        description="Bearer <supabase_access_token>",
    ),
    x_dev_user_email: Optional[str] = Header(
        default=None,
        alias="X-Dev-User-Email",
        description="Development user email override when DEV_MODE=true",
    ),
    db: AsyncSession = Depends(get_db),
) -> RequestContext:
    """CurrentUserProvider — every normal protected endpoint. See _build_request_context."""
    return await _build_request_context(authorization, x_dev_user_email, db)


async def get_request_context_sse(
    token: Optional[str] = Query(default=None, description="Bearer token — browser EventSource cannot send headers"),
    dev_email: Optional[str] = Query(default=None, description="Development user email override when DEV_MODE=true"),
    db: AsyncSession = Depends(get_db),
) -> RequestContext:
    """
    CurrentUserProvider for SSE connections only (GET /notifications/stream).

    Browser EventSource cannot set a custom Authorization header, so the token
    travels as a query parameter here instead — the only difference from
    get_request_context. Same identity resolution logic, via _build_request_context.
    """
    authorization = f"Bearer {token}" if token else None
    return await _build_request_context(authorization, dev_email, db)


# ── Permission Dependency Factories ───────────────────────────────────────────

def require_permission(module: str, action: str):
    """
    Factory that returns a FastAPI dependency enforcing a specific permission.

    Usage in router:
        @router.get("/projects", dependencies=[Depends(require_permission("projects", "view"))])
    """
    async def _check(ctx: RequestContext = Depends(get_request_context)) -> None:
        authorization_service.assert_has_permission(ctx, module, action)
    return _check


def require_super_admin():
    """
    Dependency that restricts an endpoint to Super Admins only.

    Usage:
        @router.get("/admin/users", dependencies=[Depends(require_super_admin())])
    """
    async def _check(ctx: RequestContext = Depends(get_request_context)) -> None:
        authorization_service.assert_super_admin(ctx)
    return _check

