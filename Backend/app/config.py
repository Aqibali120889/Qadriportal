"""
app/config.py
─────────────────────────────────────────────────────────────────────────────
Centralised, strongly-typed application configuration.

All values are loaded from environment variables or the `.env` file at startup.
No hard-coded defaults exist for secrets or connection strings.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_ENV: str = Field(default="development")
    DEBUG: bool = Field(default=False)
    LOG_LEVEL: str = Field(default="INFO")

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        ...,
        description="Async PostgreSQL connection string (postgresql+asyncpg://...)",
    )

    # ── Supabase Storage ──────────────────────────────────────────────────────
    SUPABASE_URL: str = Field(..., description="https://<project-ref>.supabase.co")
    SUPABASE_SERVICE_KEY: str = Field(
        ...,
        description="Supabase service-role key (server-side only, never expose to client)",
    )
    SUPABASE_STORAGE_BUCKET: str = Field(
        default="rfq-drawings",
        description="Supabase Storage bucket for engineering PDF drawings",
    )

    # ── Internal Webhook Security ─────────────────────────────────────────────
    INTERNAL_API_KEY: str = Field(
        ...,
        description="Shared secret header value sent by n8n. Must match X-Internal-Key.",
    )

    # ── JWT Validation ────────────────────────────────────────────────────────
    SUPABASE_JWT_SECRET: str = Field(
        ...,
        description=(
            "Supabase project JWT secret for validating access tokens. "
            "Found in Supabase Dashboard → Settings → API → JWT Secret."
        ),
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed CORS origins",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS_ORIGINS as a Python list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── Development ───────────────────────────────────────────────────────────
    DEV_MODE: bool = Field(
        default=False,
        description=(
            "When True, bypasses user is_active and status checks in get_request_context. "
            "JWT decode, user load, department resolution, and RequestContext construction "
            "remain fully intact. Set True only in development; never in production."
        ),
    )

    # ── Job Number ────────────────────────────────────────────────────────────
    JOB_NUMBER_PREFIX: str = Field(
        default="RFQ",
        description="Prefix used when auto-generating project job numbers (e.g. RFQ-2026-001)",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the singleton Settings instance.
    Cached so environment is only parsed once per process.
    """
    return Settings()
