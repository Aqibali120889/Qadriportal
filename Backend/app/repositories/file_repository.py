"""
app/repositories/file_repository.py
─────────────────────────────────────────────────────────────────────────────
Data access layer for `files` and `file_versions` tables.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.file import File
from app.models.file_version import FileVersion
from app.repositories.base import BaseRepository


class FileRepository(BaseRepository[File]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, File)

    async def get_by_project_id(self, project_id: str) -> List[File]:
        """Return all non-deleted files belonging to a project."""
        result = await self._session.execute(
            select(File)
            .where(File.project_id == project_id)
            .where(File.deleted_at.is_(None))
            .options(selectinload(File.versions))
            .order_by(File.created_at.asc())
        )
        return list(result.scalars().all())


class FileVersionRepository(BaseRepository[FileVersion]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, FileVersion)

    async def get_by_file_id(self, file_id: str) -> List[FileVersion]:
        """Return all versions of a file ordered by version number."""
        result = await self._session.execute(
            select(FileVersion)
            .where(FileVersion.file_id == file_id)
            .order_by(FileVersion.version.asc())
        )
        return list(result.scalars().all())
