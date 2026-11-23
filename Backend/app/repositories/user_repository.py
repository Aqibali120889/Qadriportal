"""
app/repositories/user_repository.py
─────────────────────────────────────────────────────────────────────────────
Repository for the `users` table and user management operations.

Follows the Repository Pattern — no business logic, only data access.
All queries are async (asyncpg via SQLAlchemy).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import case, func, or_, select, update, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.department import Department
from app.models.login_history import LoginHistory
from app.models.role import Role, RolePermission
from app.models.user import User, UserStatus
from app.models.user_session import SessionStatus, UserSession
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Data access layer for the users table and user management."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def get_by_id_with_role_and_department(self, user_id: str) -> Optional[User]:
        """
        Load a User with their Role (+ RolePermissions) and Department
        in a single JOIN query. Used by CurrentUserProvider.
        """
        stmt = (
            select(User)
            .where(User.id == user_id)
            .where(User.deleted_at.is_(None))
            .options(
                selectinload(User.role).selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission),
                selectinload(User.department),
            )
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Look up a user by email address."""
        stmt = (
            select(User)
            .where(User.email == email.lower().strip())
            .where(User.deleted_at.is_(None))
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_last_login(self, user_id: str) -> None:
        """Update users.last_login to current UTC time and transition INVITED → ACTIVE status."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        user = await self.get_by_id(user_id)
        if user:
            user.last_login = now
            user.updated_at = now
            if user.status == UserStatus.INVITED:
                user.status = UserStatus.ACTIVE
                user.is_active = True
                user.email_verified = True

    async def set_user_status(self, user_id: str, status: UserStatus, updated_by_id: str) -> bool:
        """Update user status (ACTIVE, INVITED, INACTIVE, LOCKED)."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        is_active = (status != UserStatus.INACTIVE and status != UserStatus.LOCKED)
        stmt = (
            update(User)
            .where(User.id == user_id)
            .where(User.deleted_at.is_(None))
            .values(status=status, is_active=is_active, updated_by=updated_by_id, updated_at=now)
        )
        res = await self._session.execute(stmt)
        return res.rowcount > 0

    async def set_user_role(self, user_id: str, role_id: Optional[str], updated_by_id: str) -> bool:
        """Assign role to user."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = (
            update(User)
            .where(User.id == user_id)
            .where(User.deleted_at.is_(None))
            .values(role_id=role_id, updated_by=updated_by_id, updated_at=now)
        )
        res = await self._session.execute(stmt)
        return res.rowcount > 0

    async def set_user_department(self, user_id: str, department_id: Optional[str], updated_by_id: str) -> bool:
        """Assign department to user."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = (
            update(User)
            .where(User.id == user_id)
            .where(User.deleted_at.is_(None))
            .values(department_id=department_id, updated_by=updated_by_id, updated_at=now)
        )
        res = await self._session.execute(stmt)
        return res.rowcount > 0

    async def get_user_sessions(self, user_id: str) -> List[UserSession]:
        """Fetch all sessions for a specific user."""
        stmt = (
            select(UserSession)
            .where(UserSession.user_id == user_id)
            .order_by(UserSession.created_at.desc())
        )
        res = await self._session.execute(stmt)
        return list(res.scalars().all())

    async def revoke_session(self, session_id: str, user_id: str) -> bool:
        """Revoke a specific user session."""
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .where(UserSession.user_id == user_id)
            .values(status=SessionStatus.REVOKED)
        )
        res = await self._session.execute(stmt)
        return res.rowcount > 0

    async def get_user_login_history(self, user_id: str, limit: int = 20) -> List[LoginHistory]:
        """Fetch login history for a specific user."""
        stmt = (
            select(LoginHistory)
            .where(LoginHistory.user_id == user_id)
            .order_by(LoginHistory.login_time.desc())
            .limit(limit)
        )
        res = await self._session.execute(stmt)
        return list(res.scalars().all())

    async def get_user_security_events(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Fetch security events for a specific user."""
        stmt = text("""
            SELECT id, user_id, ip_address, event_type, description, created_at
            FROM security_events
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT :limit
        """)
        res = await self._session.execute(stmt, {"uid": user_id, "limit": limit})
        rows = res.fetchall()
        return [
            {
                "id": str(r[0]),
                "user_id": str(r[1]) if r[1] else None,
                "ip_address": r[2],
                "event_type": r[3],
                "description": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]

    async def get_user_dashboard_counts(self) -> Dict[str, int]:
        """Calculate counts for the user management dashboard cards."""
        tot_stmt = select(func.count(User.id)).where(User.deleted_at.is_(None))
        tot = (await self._session.execute(tot_stmt)).scalar() or 0

        # Online users (active session)
        onl_stmt = select(func.count(func.distinct(UserSession.user_id))).where(
            UserSession.status == SessionStatus.ACTIVE
        )
        onl = (await self._session.execute(onl_stmt)).scalar() or 0

        # Status counts
        st_stmt = select(
            func.sum(case((User.status == UserStatus.INVITED, 1), else_=0)).label("invited"),
            func.sum(case((User.status == UserStatus.LOCKED, 1), else_=0)).label("locked"),
            func.sum(case((User.status == UserStatus.INACTIVE, 1), else_=0)).label("inactive"),
            func.sum(case((User.department_id.isnot(None), 1), else_=0)).label("dept_users"),
        ).where(User.deleted_at.is_(None))
        st_res = (await self._session.execute(st_stmt)).first()

        inv = st_res.invited if st_res and st_res.invited else 0
        loc = st_res.locked if st_res and st_res.locked else 0
        ina = st_res.inactive if st_res and st_res.inactive else 0
        dep = st_res.dept_users if st_res and st_res.dept_users else 0

        # Admins count
        adm_stmt = select(func.count(User.id)).select_from(User).join(Role, Role.id == User.role_id).where(
            Role.is_system == True, User.deleted_at.is_(None)  # noqa: E712
        )
        adm = (await self._session.execute(adm_stmt)).scalar() or 0

        return {
            "total_users": tot,
            "online_users": onl,
            "invited_users": inv,
            "locked_users": loc,
            "inactive_users": ina,
            "admins": adm,
            "department_users": dep,
        }
