"""
app/database.py
─────────────────────────────────────────────────────────────────────────────
Async SQLAlchemy engine and session factory.

Architecture notes:
- Uses asyncpg driver for non-blocking PostgreSQL I/O.
- Session is scoped per request via FastAPI dependency injection.
- expire_on_commit=False prevents lazy-load errors after commit in async context.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

settings = get_settings()

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,          # Logs SQL when DEBUG=true — disable in production
    pool_pre_ping=True,           # Validates connection health before checkout
    pool_size=5,
    max_overflow=0,
    pool_timeout=30,
    pool_recycle=300,             # Recycle connections every 5 min to avoid cloud idle timeouts
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,       # Required for async — prevents implicit lazy loads
)


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session per request.
    The session is automatically closed after the request completes.
    Transactions are not auto-committed — services must commit explicitly.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
