"""
app/api/v1/auth.py
─────────────────────────────────────────────────────────────────────────────
Authentication API endpoints.

FastAPI owns ONLY post-authentication side effects and identity queries.
Supabase Auth (called directly from React) handles:
  - Login (signInWithPassword)
  - Logout (signOut)
  - Token refresh (automatic via Supabase JS SDK)
  - Password reset (resetPasswordForEmail)

This router exposes:
  GET    /api/v1/auth/me           — return current user identity
  POST   /api/v1/auth/session      — register session after Supabase login
  DELETE /api/v1/auth/session/{id} — revoke session on logout
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.models.notification import NotificationType
from app.schemas.auth import (
    MeResponse,
    SessionCreateRequest,
    SessionCreateResponse,
)
from app.services import notification_service
from app.services.auth_service import AuthService

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current user identity",
    description=(
        "Returns the complete identity and authorization context for the "
        "authenticated user, including department, role, and resolved permissions. "
        "The frontend AuthContext stores this response."
    ),
    responses={
        401: {"description": "Missing or invalid JWT"},
        403: {"description": "Account inactive or not assigned to a department"},
    },
)
async def get_me(
    ctx: RequestContext = Depends(get_request_context),
) -> MeResponse:
    """
    Return the authenticated user's identity from the resolved RequestContext.

    No DB call — all data was already loaded by the CurrentUserProvider.
    """
    logger.info("me_requested", user_id=ctx.user_id, department=ctx.department_code)

    return MeResponse(
        user_id=ctx.user_id,
        department_id=ctx.department_id,
        department_name=ctx.department_name,
        department_code=ctx.department_code,
        role_id=ctx.role_id,
        role_name=ctx.role_name,
        permissions=sorted(ctx.permissions),
        is_super_admin=ctx.is_super_admin,
        session_id=ctx.session_id,
    )


@router.post(
    "/session",
    response_model=SessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register session after Supabase login",
    description=(
        "Called by the frontend immediately after a successful Supabase Auth login. "
        "Records the session in user_sessions for tracking purposes, updates "
        "users.last_login, and inserts a login_history record. "
        "Returns the session_id for use in logout tracking."
    ),
    responses={
        401: {"description": "Missing or invalid JWT"},
    },
)
async def create_session(
    request: SessionCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> SessionCreateResponse:
    """
    Register a new session tracking record.

    Authentication has already been performed by Supabase Auth.
    This endpoint only records the device/IP metadata and audit trail.
    """
    auth_service = AuthService(db)
    response = await auth_service.on_login_success(ctx.user_id, request)
    await db.commit()

    logger.info(
        "session_registered",
        user_id=ctx.user_id,
        session_id=response.session_id,
        ip=request.ip_address,
    )

    try:
        await notification_service.notify(
            db,
            event_type="user_login",
            title="Signed in",
            message=f"New session on {request.device or 'device'} ({request.browser or 'browser'}).",
            severity=NotificationType.INFO,
            department_id=ctx.department_id,
            department_code=ctx.department_code,
            user_id=ctx.user_id,
        )
    except Exception as notif_exc:
        logger.warning("notification_emit_failed", error=str(notif_exc))

    return response


@router.delete(
    "/session/{session_id}",
    response_class=Response,
    summary="Revoke session on logout",
    description=(
        "Called by the frontend after supabase.auth.signOut() completes. "
        "Marks the session REVOKED and records a security_events entry. "
        "Returns 204 No Content on success."
    ),
)
async def revoke_session(
    session_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Revoke a session tracking record on logout.

    Supabase Auth signOut() has already been called by the frontend.
    This only updates the backend session tracking record.
    """
    auth_service = AuthService(db)
    await auth_service.on_logout(ctx, session_id)
    await db.commit()

    try:
        await notification_service.notify(
            db,
            event_type="user_logout",
            title="Signed out",
            message="Session ended.",
            severity=NotificationType.INFO,
            department_id=ctx.department_id,
            department_code=ctx.department_code,
            user_id=ctx.user_id,
        )
    except Exception as notif_exc:
        logger.warning("notification_emit_failed", error=str(notif_exc))

    return Response(status_code=status.HTTP_204_NO_CONTENT)
