"""
app/services/auth_service.py
─────────────────────────────────────────────────────────────────────────────
Authentication Service — post-authentication side effects only.

FastAPI NEVER handles login, logout, or token refresh.
Supabase Auth (called directly from the React frontend) owns all of that.

This service is responsible for:
  1. on_login_success  — called after the frontend confirms a Supabase login
                         to record the session, update last_login, and write
                         the login_history record.
  2. on_logout         — called when the frontend has already signed out of
                         Supabase Auth; this service marks the session REVOKED
                         and records the security_event.
  3. get_me            — returns the current user's identity as a MeResponse,
                         assembled from the already-resolved RequestContext.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.logging import get_logger
from app.repositories.auth_repository import AuthRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import MeResponse, SessionCreateRequest, SessionCreateResponse

logger = get_logger(__name__)

# Sessions are considered valid for 7 days (matches Supabase refresh window)
_SESSION_TTL_DAYS = 7


class AuthService:
    """
    Post-authentication side effects service.

    All methods operate within an existing DB session — they do not own
    commit(). The caller (API layer) is responsible for committing.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._user_repo = UserRepository(session)
        self._auth_repo = AuthRepository(session)

    async def on_login_success(
        self, user_id: str, request: SessionCreateRequest
    ) -> SessionCreateResponse:
        """
        Record a successful login session.

        Called by POST /api/v1/auth/session after the frontend has authenticated
        with Supabase Auth and received a valid JWT.

        Steps:
          1. Create user_sessions row (ACTIVE, no refresh_token stored)
          2. Update users.last_login to now
          3. Insert login_history (SUCCESS)

        Returns:
            SessionCreateResponse with the new session_id
        """
        expires_at = datetime.now(timezone.utc) + timedelta(days=_SESSION_TTL_DAYS)
        expires_at_naive = expires_at.replace(tzinfo=None)

        # 1. Create session tracking record
        session_record = await self._auth_repo.create_session(
            user_id=user_id,
            ip_address=request.ip_address,
            device=request.device,
            browser=request.browser,
            operating_system=request.operating_system,
            expires_at=expires_at_naive,
        )

        # 2. Update last_login
        await self._user_repo.update_last_login(user_id)

        # 3. Record login audit
        await self._auth_repo.record_login_history(
            user_id=user_id,
            email=request.email,
            ip_address=request.ip_address,
            browser=request.browser,
            operating_system=request.operating_system,
            login_status="SUCCESS",
        )

        logger.info(
            "session_created",
            user_id=user_id,
            session_id=session_record.id,
            ip=request.ip_address,
        )

        return SessionCreateResponse(session_id=session_record.id)

    async def on_logout(
        self, ctx: RequestContext, session_id: str
    ) -> None:
        """
        Record a logout event.

        Called by DELETE /api/v1/auth/session/{session_id} after the frontend
        has already called supabase.auth.signOut().

        Steps:
          1. Mark user_sessions row as REVOKED
          2. Insert security_events (LOGOUT)
        """
        await self._auth_repo.revoke_session(session_id)

        await self._auth_repo.record_security_event(
            event_type="LOGOUT",
            description=f"User {ctx.user_id} logged out. Session {session_id} revoked.",
            user_id=ctx.user_id,
        )

        logger.info(
            "session_revoked",
            user_id=ctx.user_id,
            session_id=session_id,
        )

    def get_me(self, ctx: RequestContext) -> MeResponse:
        """
        Return the current user's identity from the already-resolved RequestContext.

        No DB call — all information is already in the immutable RequestContext
        built by the CurrentUserProvider (get_request_context dependency).
        """
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
