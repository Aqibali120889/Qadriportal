"""
app/repositories/auth_repository.py
─────────────────────────────────────────────────────────────────────────────
Repository for authentication-related audit tables.

Handles:
  - user_sessions     : session tracking (create, revoke, expire)
  - login_history     : login audit records (success and failure)
  - security_events   : unauthorized access / permission failure events

FastAPI never handles passwords or token refresh.
These writes are post-authentication side effects only.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_session import SessionStatus, UserSession


class AuthRepository:
    """Data access for authentication audit tables."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── user_sessions ─────────────────────────────────────────────────────────

    async def create_session(
        self,
        user_id: str,
        ip_address: Optional[str],
        device: Optional[str],
        browser: Optional[str],
        operating_system: Optional[str],
        expires_at: Optional[datetime],
    ) -> UserSession:
        """
        Create a new ACTIVE session tracking record.

        Called by auth_service.on_login_success() after Supabase Auth confirms
        the login. No refresh_token is stored — Supabase Auth manages tokens.
        """
        session_record = UserSession(
            user_id=user_id,
            ip_address=ip_address,
            device=device,
            browser=browser,
            operating_system=operating_system,
            expires_at=expires_at,
            status=SessionStatus.ACTIVE,
        )
        self._session.add(session_record)
        await self._session.flush()
        return session_record

    async def get_active_session(self, session_id: str) -> Optional[UserSession]:
        """Retrieve an ACTIVE session by its UUID."""
        stmt = (
            select(UserSession)
            .where(UserSession.id == session_id)
            .where(UserSession.status == SessionStatus.ACTIVE)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke_session(self, session_id: str) -> None:
        """Mark a session as REVOKED (logout)."""
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .where(UserSession.status == SessionStatus.ACTIVE)
            .values(status=SessionStatus.REVOKED)
        )
        await self._session.execute(stmt)

    async def expire_old_sessions(self, user_id: str) -> None:
        """
        Mark all ACTIVE sessions for a user as EXPIRED.
        Used during forced logout or account deactivation.
        """
        stmt = (
            update(UserSession)
            .where(UserSession.user_id == user_id)
            .where(UserSession.status == SessionStatus.ACTIVE)
            .values(status=SessionStatus.EXPIRED)
        )
        await self._session.execute(stmt)

    # ── login_history ─────────────────────────────────────────────────────────

    async def record_login_history(
        self,
        user_id: Optional[str],
        email: str,
        ip_address: Optional[str],
        browser: Optional[str],
        operating_system: Optional[str],
        login_status: str,          # e.g. "SUCCESS", "FAILED", "LOCKED"
        failure_reason: Optional[str] = None,
    ) -> None:
        """
        Insert a login_history record.
        Called for both successful and failed logins.
        Records are immutable — never updated after insert.
        """
        from sqlalchemy import text
        now = datetime.now(timezone.utc)
        await self._session.execute(
            text(
                """
                INSERT INTO login_history
                    (user_id, email, ip_address, browser, operating_system,
                     login_status, failure_reason, login_time)
                VALUES
                    (:user_id, :email, :ip_address, :browser, :operating_system,
                     CAST(:login_status AS login_status), :failure_reason, :login_time)
                """
            ),
            {
                "user_id": user_id,
                "email": email,
                "ip_address": ip_address,
                "browser": browser,
                "operating_system": operating_system,
                "login_status": login_status,
                "failure_reason": failure_reason,
                "login_time": now,
            },
        )

    # ── security_events ───────────────────────────────────────────────────────

    async def record_security_event(
        self,
        event_type: str,
        description: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Insert a security_events record.
        Used for: LOGOUT, UNAUTHORIZED_ACCESS, PERMISSION_DENIED, SESSION_EXPIRED.
        Records are immutable — never updated after insert.
        """
        from sqlalchemy import text
        await self._session.execute(
            text(
                """
                INSERT INTO security_events
                    (user_id, ip_address, event_type, description, created_at)
                VALUES
                    (:user_id, :ip_address, :event_type, :description, NOW())
                """
            ),
            {
                "user_id": user_id,
                "ip_address": ip_address,
                "event_type": event_type,
                "description": description,
            },
        )
