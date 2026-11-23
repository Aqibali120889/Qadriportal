"""
app/core/security.py
─────────────────────────────────────────────────────────────────────────────
Security utilities for Phase 2.

Provides token hashing for session tracking.
Supabase Auth handles all password operations — this module does NOT
implement password hashing or validation.
"""

from __future__ import annotations

import hashlib
import secrets


def hash_token(token: str) -> str:
    """
    Return the SHA-256 hex digest of a token string.

    Used to safely store session identifiers without exposing the raw token.
    Even if the database is compromised, the original token cannot be derived.

    Args:
        token: Raw token string (e.g. a session identifier from the frontend).

    Returns:
        64-character lowercase hex string (SHA-256 digest).
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_session_token() -> str:
    """
    Generate a cryptographically secure random session identifier.

    Returns:
        32-byte URL-safe base64 token (43 characters).
    """
    return secrets.token_urlsafe(32)
