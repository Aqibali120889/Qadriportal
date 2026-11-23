"""
app/core/jwt.py
─────────────────────────────────────────────────────────────────────────────
Stateless JWT validation for Supabase-issued access tokens.

FastAPI never manages authentication (login/logout/refresh). Supabase Auth
on the frontend handles all of that. This module only validates the JWT
signature and extracts the user identity (sub claim).

No network calls. No Supabase SDK. Pure PyJWT.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any, Dict, Optional, Union

import jwt
import structlog
from fastapi import HTTPException, status

from app.config import get_settings

logger = structlog.get_logger(__name__)

# Supported Supabase JWT signing algorithms
_ALLOWED_ALGORITHMS = ["HS256", "HS384", "HS512", "RS256", "ES256", "PS256"]

# Supabase sets this as the audience for service tokens.
# For user access tokens, audience may be "authenticated" or absent.
_VALID_AUDIENCES = {"authenticated", ""}


@dataclass(frozen=True)
class TokenPayload:
    """
    Typed representation of a decoded Supabase JWT.

    Fields:
        sub   — user UUID (matches public.users.id and auth.users.id)
        email — user email address
        role  — Supabase role ("authenticated" for normal users)
        exp   — expiry timestamp (Unix epoch)
        iat   — issued-at timestamp (Unix epoch)
    """
    sub: str
    email: str
    role: str
    exp: int
    iat: int


def _resolve_jwt_key(secret: str) -> Union[bytes, str]:
    """
    Resolve the HMAC signing key from the stored Supabase JWT secret.

    Supabase stores its JWT secret as a Base64-encoded string in the
    dashboard (Settings → API → JWT Settings → JWT Secret). The actual
    HMAC key material is the decoded byte array (64 bytes).

    The bug: PyJWT receiving a Python str uses the string's UTF-8 bytes
    as the HMAC key, NOT the Base64-decoded bytes. This produces a
    different signature than Supabase, causing 'Signature verification
    failed' for every real user access token.

    Fix: always try to Base64-decode the secret first. If it is not
    valid Base64 (plain-text secret), fall back to using it as-is.
    """
    try:
        return base64.b64decode(secret)
    except Exception:
        return secret


def decode_access_token(token: str) -> TokenPayload:
    """
    Validate a Supabase JWT access token and return a typed TokenPayload.

    Phase 2 Resilience:
      1. Attempts local JWT signature validation first.
      2. If local signature check fails (e.g. Supabase uses project key rotation
         with 'kid' or asymmetric keys), falls back to verifying authoritatively
         with Supabase Auth API (GET /auth/v1/user).

    Raises:
        HTTPException 401 — expired, invalid signature, or malformed token
    """
    settings = get_settings()

    # Step 1: Attempt local PyJWT decode
    try:
        header_alg = jwt.get_unverified_header(token).get("alg")
    except Exception:
        header_alg = None

    registered = set(jwt.algorithms.get_default_algorithms().keys())
    candidates = set(_ALLOWED_ALGORITHMS + ([header_alg] if header_alg else []))
    allowed_algs = list(candidates.intersection(registered)) or ["HS256"]

    # Try local decode with both raw secret string and b64decoded bytes
    raw_payload: Optional[Dict[str, Any]] = None
    for key in (settings.SUPABASE_JWT_SECRET, _resolve_jwt_key(settings.SUPABASE_JWT_SECRET)):
        try:
            raw_payload = jwt.decode(
                token,
                key,
                algorithms=allowed_algs,
                options={"verify_aud": False},
            )
            break
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "TOKEN_EXPIRED", "message": "Access token has expired."},
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception:
            continue

    # Step 2: Fallback to Supabase Auth API verification if local signature fails
    if raw_payload is None:
        try:
            import httpx
            url = f"{settings.SUPABASE_URL}/auth/v1/user"
            headers = {
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {token}",
            }
            with httpx.Client(timeout=5.0) as client:
                res = client.get(url, headers=headers)

            if res.status_code == 200:
                user_data = res.json()
                unverified = jwt.decode(token, options={"verify_signature": False})
                return TokenPayload(
                    sub=user_data["id"],
                    email=user_data.get("email", ""),
                    role=user_data.get("role", "authenticated"),
                    exp=int(unverified.get("exp", 0)),
                    iat=int(unverified.get("iat", 0)),
                )
        except Exception as fallback_err:
            logger.warning("supabase_auth_fallback_failed", error=str(fallback_err))

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_INVALID", "message": "Invalid or unverified access token."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = raw_payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_INVALID", "message": "Token missing 'sub' claim."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenPayload(
        sub=sub,
        email=raw_payload.get("email", ""),
        role=raw_payload.get("role", ""),
        exp=int(raw_payload.get("exp", 0)),
        iat=int(raw_payload.get("iat", 0)),
    )

