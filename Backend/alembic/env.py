"""
alembic/env.py
─────────────────────────────────────────────────────────────────────────────
Alembic environment configuration for async SQLAlchemy.

This env.py is configured for the Qadri Portal backend using asyncpg.
The migration target is the existing Supabase PostgreSQL database.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

# Import all models so Alembic can detect schema changes
from app.models import Base  # noqa: F401 — registers all model metadata
from app.config import get_settings

# Alembic config object
config = context.config

# Load logging config from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point Alembic at our metadata
target_metadata = Base.metadata

# Inject the DATABASE_URL from our settings (overrides alembic.ini sqlalchemy.url)
settings = get_settings()
config.set_main_option(
    "sqlalchemy.url",
    # Alembic needs the sync driver for offline mode; asyncpg for online mode
    settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"),
)


def run_migrations_offline() -> None:
    """Run migrations without a live database connection (generates SQL script)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations with an async SQLAlchemy engine."""
    # Rewrite the URL to use asyncpg for actual execution
    async_url = settings.DATABASE_URL
    connectable = async_engine_from_config(
        {"sqlalchemy.url": async_url, "sqlalchemy.poolclass": pool.NullPool},
        prefix="sqlalchemy.",
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
