"""
app/schemas/auth.py
─────────────────────────────────────────────────────────────────────────────
Pydantic schemas for the authentication and identity API layer.

All schemas are response-oriented — FastAPI never handles login or passwords.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    """
    Request body for POST /api/v1/auth/session.

    Called by the frontend after a successful Supabase Auth login to register
    the session and record device/browser metadata for security tracking.
    """
    email: str = Field(..., description="User email address (for login_history record)")
    ip_address: Optional[str] = Field(None, max_length=45, description="Client IP address")
    device: Optional[str] = Field(None, max_length=255, description="Device type (e.g. Desktop, Mobile)")
    browser: Optional[str] = Field(None, max_length=255, description="Browser name and version")
    operating_system: Optional[str] = Field(None, max_length=255, description="OS name and version")


class SessionCreateResponse(BaseModel):
    """Response from POST /api/v1/auth/session."""
    session_id: str = Field(..., description="UUID of the created user_sessions row")


class MeResponse(BaseModel):
    """
    Response from GET /api/v1/auth/me.

    The complete identity and authorization context for the authenticated user.
    The frontend AuthContext stores this object.
    """
    user_id: str = Field(..., description="User UUID (matches Supabase Auth sub)")
    department_id: str = Field(..., description="User's department UUID")
    department_name: str = Field(..., description="Human-readable department name")
    department_code: str = Field(..., description="Short department code (e.g. CE, FOUNDRY)")
    role_id: str = Field(..., description="User's role UUID")
    role_name: str = Field(..., description="Role name (e.g. Engineer, Department Admin)")
    permissions: List[str] = Field(
        ...,
        description="Sorted list of 'module:action' permission strings granted to this role"
    )
    is_super_admin: bool = Field(
        ...,
        description="True if this user has unrestricted cross-department access"
    )
    session_id: Optional[str] = Field(
        None,
        description="UUID of the active user_sessions row (if session was registered)"
    )


class UnauthorizedResponse(BaseModel):
    """Standard 401 error body."""
    code: str
    message: str


class ForbiddenResponse(BaseModel):
    """Standard 403 error body."""
    code: str
    message: str
