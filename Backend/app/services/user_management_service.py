"""
app/services/user_management_service.py
─────────────────────────────────────────────────────────────────────────────
Service layer for User Management operations (Super Admin).

Handles user listing, detail drawers, status management (Lock, Unlock, Deactivate),
role/department assignments, session revocation, and security audit logging.

Phase 2C: create_user() now calls the Supabase Admin API to create a real
          auth.users record and send an invitation email. The Supabase-returned
          UUID is used as public.users.id to keep auth.users.id == public.users.id.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.models.user import User, UserStatus
from app.models.user_session import UserSession
from app.repositories.auth_repository import AuthRepository
from app.repositories.user_repository import UserRepository
from app.services.admin_users_service import get_user_detail, get_users_list

logger = get_logger(__name__)
_settings = get_settings()


async def _delete_supabase_auth_user(auth_user_id: str) -> None:
    """Compensation action: delete a created Supabase Auth user if DB insertion fails."""
    url = f"{_settings.SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}"
    headers = {
        "apikey": _settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {_settings.SUPABASE_SERVICE_KEY}",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(url, headers=headers)
        logger.info("supabase_auth_user_rolled_back", auth_user_id=auth_user_id)
    except Exception as exc:
        logger.error("supabase_auth_user_rollback_failed", auth_user_id=auth_user_id, error=str(exc))


async def _invite_supabase_auth_user(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    redirect_to: Optional[str] = None,
) -> str:
    """
    Create a Supabase Auth user via the Admin API and trigger the invitation
    email so the user can set their own password.

    Returns the auth.users.id (UUID string) that MUST be used as public.users.id.

    The invitation flow:
      1. POST /auth/v1/invite → creates auth.users row + sends invite email with redirect_to
      2. User clicks invite link → redirected to frontend setup password page → sets password → logs in
      3. Supabase JWT sub == returned id == public.users.id

    Raises HTTPException 409 if the email is already registered in auth.users.
    Raises HTTPException 502 on Supabase API error.
    """
    url = f"{_settings.SUPABASE_URL}/auth/v1/invite"
    headers = {
        "apikey": _settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {_settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    # Determine default redirect URL if not specified
    if not redirect_to:
        # Use first CORS origin or default frontend origin
        origins = _settings.cors_origins_list
        base_origin = origins[0] if origins else "http://localhost:5173"
        redirect_to = f"{base_origin.rstrip('/')}/reset-password"

    payload = {
        "email": email,
        "redirect_to": redirect_to,
        "data": {
            "first_name": first_name or "",
            "last_name": last_name or "",
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        
        # If SMTP/email send rate limit occurs (429), fall back to admin generate_link
        if resp.status_code == 429:
            logger.warning("supabase_invite_rate_limited_falling_back_to_generate_link", email=email)
            gen_url = f"{_settings.SUPABASE_URL}/auth/v1/admin/generate_link"
            gen_payload = {
                "type": "invite",
                "email": email,
                "redirect_to": redirect_to,
                "data": payload["data"],
            }
            resp = await client.post(gen_url, json=gen_payload, headers=headers)

    if resp.status_code == 422 or "already" in resp.text.lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A Supabase Auth account with email '{email}' already exists.",
        )
    if not resp.is_success:
        logger.error(
            "supabase_invite_failed",
            email=email,
            status=resp.status_code,
            body=resp.text[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create Supabase Auth account. Please try again.",
        )

    data = resp.json()
    auth_user_id: str = data["id"]
    logger.info("supabase_auth_user_invited", email=email, auth_user_id=auth_user_id, redirect_to=redirect_to)
    return auth_user_id


class UserManagementService:
    """Business logic for Super Admin User Management."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = UserRepository(session)
        self._auth_repo = AuthRepository(session)

    async def list_users(
        self,
        *,
        search: Optional[str] = None,
        department_id: Optional[str] = None,
        role_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        sort: str = "name_asc",
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Paginated list of users enriched with statistics."""
        data = await get_users_list(
            self._session,
            search=search,
            department_id=department_id,
            role_id=role_id,
            status_filter=status_filter,
            sort=sort,
            page=page,
            page_size=page_size,
        )
        # Attach dashboard counts
        counts = await self._repo.get_user_dashboard_counts()
        data["dashboard_counts"] = counts
        return data

    async def get_user_detail(self, user_id: str) -> Dict[str, Any]:
        """Fetch full user detail for side drawer."""
        detail = await get_user_detail(self._session, user_id)
        if not detail:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
        return detail

    async def create_user(
        self,
        email: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        department_id: Optional[str] = None,
        role_id: Optional[str] = None,
        redirect_to: Optional[str] = None,
        ctx: Optional[RequestContext] = None,
    ) -> User:
        """
        Create / Invite a new user.

        Flow:
          1. Validate email + duplicate check in public.users
          2. Validate department_id and role_id existence if provided
          3. Call Supabase Auth Admin API → creates auth.users + sends invite email with redirect_to
          4. Use returned auth.users.id as public.users.id
          5. INSERT public.users with that UUID (UserStatus.INVITED)
          6. Transaction safety: if DB insert fails, delete auth.users record
          7. Record security audit events
        """
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise HTTPException(status_code=422, detail="A valid email address is required.")

        # Validate department existence if provided
        if department_id:
            from sqlalchemy import select, text
            from app.models.department import Department
            dept_res = await self._session.execute(
                select(Department).where(Department.id == department_id, Department.deleted_at.is_(None))
            )
            if not dept_res.scalar_one_or_none():
                raise HTTPException(status_code=422, detail=f"Department '{department_id}' does not exist.")

        # Validate role existence if provided
        if role_id:
            from sqlalchemy import select
            from app.models.role import Role
            role_res = await self._session.execute(
                select(Role).where(Role.id == role_id, Role.deleted_at.is_(None))
            )
            if not role_res.scalar_one_or_none():
                raise HTTPException(status_code=422, detail=f"Role '{role_id}' does not exist.")

        # Check public.users for duplicates first (fast, avoids Supabase call)
        existing = await self._repo.get_by_email(clean_email)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A user with email '{clean_email}' already exists in the platform.",
            )

        # Step 3: Create Supabase Auth user via /auth/v1/invite and get the UUID
        auth_user_id = await _invite_supabase_auth_user(
            email=clean_email,
            first_name=first_name,
            last_name=last_name,
            redirect_to=redirect_to,
        )

        creator_id = ctx.user_id if ctx else None
        user = User(
            id=auth_user_id,        # CRITICAL: must match auth.users.id
            email=clean_email,
            first_name=first_name.strip() if first_name else None,
            last_name=last_name.strip() if last_name else None,
            department_id=department_id or None,
            role_id=role_id or None,
            status=UserStatus.INVITED,
            is_active=True,
            email_verified=False,
            mfa_enabled=False,
            created_by=creator_id,
            updated_by=creator_id,
        )

        try:
            await self._repo.add(user)
            await self._session.flush()

            if ctx:
                await self._auth_repo.record_security_event(
                    event_type="USER_INVITED",
                    description=f"User '{user.email}' invited by Admin {ctx.user_id}. Supabase invitation email sent.",
                    user_id=user.id,
                )
                try:
                    from sqlalchemy import text
                    await self._session.execute(text("""
                        INSERT INTO entity_audit_logs (entity_name, entity_id, operation, new_data, changed_by, changed_at)
                        VALUES ('users', :eid, 'INSERT', :data, :by, now())
                    """), {
                        "eid": user.id,
                        "data": f'{{"email":"{user.email}","department_id":"{user.department_id}","role_id":"{user.role_id}","status":"INVITED"}}',
                        "by": ctx.user_id,
                    })
                except Exception:
                    pass  # Non-blocking audit log

            await self._session.commit()
            logger.info("user_invited", user_id=user.id, email=user.email)
            return user
        except Exception as db_exc:
            await self._session.rollback()
            db_exc_str = str(db_exc).lower()
            # Detect uniqueness constraint violations (PK or email unique index)
            is_duplicate = (
                "unique" in db_exc_str
                or "duplicate" in db_exc_str
                or "uniqueviolation" in db_exc_str
                or "already exists" in db_exc_str
            )
            if is_duplicate:
                # The user already exists in public.users with this UUID — don't
                # delete the Supabase Auth user since it's the correct one.
                logger.warning(
                    "create_user_db_duplicate_key",
                    email=clean_email,
                    auth_user_id=auth_user_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"A user record for '{clean_email}' already exists in the platform database. "
                        "If the user did not receive an invitation email, use the 'Resend Invite' action."
                    ),
                )
            # Other DB error — compensation rollback of the Supabase Auth user
            await _delete_supabase_auth_user(auth_user_id)
            logger.error("create_user_db_failed_rolled_back", email=clean_email, error=str(db_exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database record creation failed. Auth user rolled back.",
            )

    async def update_user(
        self,
        user_id: str,
        *,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        department_id: Optional[str] = None,
        role_id: Optional[str] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = None,
        ctx: Optional[RequestContext] = None,
    ) -> User:
        """Update user profile and assignments."""
        user = await self._repo.get_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

        if first_name is not None:
            user.first_name = first_name.strip() if first_name else None
        if last_name is not None:
            user.last_name = last_name.strip() if last_name else None
        if department_id is not None:
            user.department_id = department_id or None
        if role_id is not None:
            user.role_id = role_id or None
        if is_active is not None:
            user.is_active = is_active
        if status is not None:
            try:
                user.status = UserStatus(status.upper())
            except ValueError:
                raise HTTPException(status_code=422, detail=f"Invalid user status '{status}'.")

        if ctx:
            user.updated_by = ctx.user_id

        await self._session.commit()
        await self._session.refresh(user)
        logger.info("user_updated", user_id=user.id)
        return user

    async def lock_user(self, user_id: str, ctx: RequestContext) -> None:
        """Lock user account."""
        user = await self._repo.get_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

        await self._repo.set_user_status(user_id, UserStatus.LOCKED, ctx.user_id)
        await self._auth_repo.expire_old_sessions(user_id)
        await self._auth_repo.record_security_event(
            event_type="ACCOUNT_LOCKED",
            description=f"User account '{user.email}' locked by Admin {ctx.user_id}.",
            user_id=user_id,
        )
        await self._session.commit()
        logger.info("user_locked", user_id=user_id, by=ctx.user_id)

    async def unlock_user(self, user_id: str, ctx: RequestContext) -> None:
        """Unlock user account."""
        user = await self._repo.get_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

        await self._repo.set_user_status(user_id, UserStatus.ACTIVE, ctx.user_id)
        await self._auth_repo.record_security_event(
            event_type="ACCOUNT_UNLOCKED",
            description=f"User account '{user.email}' unlocked by Admin {ctx.user_id}.",
            user_id=user_id,
        )
        await self._session.commit()
        logger.info("user_unlocked", user_id=user_id, by=ctx.user_id)

    async def deactivate_user(self, user_id: str, ctx: RequestContext) -> None:
        """Deactivate user account."""
        user = await self._repo.get_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

        await self._repo.set_user_status(user_id, UserStatus.INACTIVE, ctx.user_id)
        await self._auth_repo.expire_old_sessions(user_id)
        await self._auth_repo.record_security_event(
            event_type="ACCOUNT_DEACTIVATED",
            description=f"User account '{user.email}' deactivated by Admin {ctx.user_id}.",
            user_id=user_id,
        )
        await self._session.commit()
        logger.info("user_deactivated", user_id=user_id, by=ctx.user_id)

    async def assign_role(self, user_id: str, role_id: Optional[str], ctx: RequestContext) -> None:
        """Assign role to user."""
        user = await self._repo.get_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

        await self._repo.set_user_role(user_id, role_id, ctx.user_id)
        await self._auth_repo.record_security_event(
            event_type="ROLE_CHANGED",
            description=f"Role for '{user.email}' updated to '{role_id}' by Admin {ctx.user_id}.",
            user_id=user_id,
        )
        await self._session.commit()
        logger.info("user_role_assigned", user_id=user_id, role_id=role_id, by=ctx.user_id)

    async def assign_department(self, user_id: str, department_id: Optional[str], ctx: RequestContext) -> None:
        """Assign department to user."""
        user = await self._repo.get_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

        await self._repo.set_user_department(user_id, department_id, ctx.user_id)
        await self._auth_repo.record_security_event(
            event_type="DEPARTMENT_ASSIGNED",
            description=f"Department for '{user.email}' updated to '{department_id}' by Admin {ctx.user_id}.",
            user_id=user_id,
        )
        await self._session.commit()
        logger.info("user_department_assigned", user_id=user_id, department_id=department_id, by=ctx.user_id)

    async def get_user_sessions(self, user_id: str) -> List[UserSession]:
        """List sessions for user."""
        return await self._repo.get_user_sessions(user_id)

    async def revoke_user_session(self, user_id: str, session_id: str, ctx: RequestContext) -> None:
        """Revoke specific user session."""
        revoked = await self._repo.revoke_session(session_id, user_id)
        if not revoked:
            raise HTTPException(status_code=404, detail=f"UserSession '{session_id}' not found.")
        await self._auth_repo.record_security_event(
            event_type="SESSION_REVOKED",
            description=f"Session '{session_id}' for user '{user_id}' terminated by Admin {ctx.user_id}.",
            user_id=user_id,
        )
        await self._session.commit()
        logger.info("user_session_revoked", user_id=user_id, session_id=session_id)

    async def get_user_history(self, user_id: str) -> List[Any]:
        """Fetch login history."""
        return await self._repo.get_user_login_history(user_id)

    async def get_user_security_events(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch security events."""
        return await self._repo.get_user_security_events(user_id)
