"""
app/repositories/base.py
─────────────────────────────────────────────────────────────────────────────
Generic async repository providing standard CRUD operations.

Design:
- Repository takes a session (not a sessionmaker) — session is owned by the service.
- Repositories do NOT commit — that responsibility belongs to the service layer.
- All methods are async — consistent with the async SQLAlchemy engine.
"""

from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """
    Generic repository for SQLAlchemy ORM models.

    Usage:
        class ProjectRepository(BaseRepository[Project]):
            def __init__(self, session):
                super().__init__(session, Project)
    """

    def __init__(self, session: AsyncSession, model: Type[ModelT]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, record_id: str) -> Optional[ModelT]:
        """Fetch a single record by primary key. Returns None if not found."""
        result = await self._session.execute(
            select(self._model).where(self._model.id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 50) -> List[ModelT]:
        """Return a paginated list of records ordered by created_at DESC."""
        result = await self._session.execute(
            select(self._model)
            .order_by(self._model.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count(self) -> int:
        """Return total number of records in the table."""
        result = await self._session.execute(
            select(func.count()).select_from(self._model)
        )
        return result.scalar_one()

    async def add(self, instance: ModelT) -> ModelT:
        """
        Add a model instance to the session.
        Does NOT flush or commit — caller controls the transaction.
        """
        self._session.add(instance)
        return instance

    async def delete(self, instance: ModelT) -> None:
        """Hard delete a record from the database."""
        await self._session.delete(instance)
