"""
app/repositories/settings_repository.py
─────────────────────────────────────────────────────────────────────────────
Repository for the `system_settings` table.

Supports category-scoped listing, key-value lookup, and bulk upsert operations.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting
from app.repositories.base import BaseRepository


class SettingsRepository(BaseRepository[SystemSetting]):
    """Data access layer for system_settings table."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SystemSetting)

    async def get_all_settings(self) -> List[SystemSetting]:
        """Return all system settings ordered by category and setting_key."""
        stmt = select(SystemSetting).order_by(SystemSetting.category.asc(), SystemSetting.setting_key.asc())
        res = await self._session.execute(stmt)
        return list(res.scalars().all())

    async def get_by_category(self, category: str) -> List[SystemSetting]:
        """Return all settings under a specific category."""
        stmt = (
            select(SystemSetting)
            .where(SystemSetting.category == category.lower().strip())
            .order_by(SystemSetting.setting_key.asc())
        )
        res = await self._session.execute(stmt)
        return list(res.scalars().all())

    async def get_by_key(self, setting_key: str) -> Optional[SystemSetting]:
        """Look up a setting by key."""
        stmt = select(SystemSetting).where(SystemSetting.setting_key == setting_key.strip())
        res = await self._session.execute(stmt)
        return res.scalar_one_or_none()

    async def upsert_setting(
        self,
        setting_key: str,
        setting_value: str,
        category: str = "general",
        description: Optional[str] = None,
        updated_by_id: Optional[str] = None,
    ) -> SystemSetting:
        """Insert or update a setting entry."""
        now = datetime.now(timezone.utc)
        existing = await self.get_by_key(setting_key)
        if existing:
            existing.setting_value = setting_value
            existing.category = category.lower().strip()
            if description:
                existing.description = description
            if updated_by_id:
                existing.updated_by = updated_by_id
            existing.updated_at = now
            return existing
        else:
            new_setting = SystemSetting(
                setting_key=setting_key.strip(),
                setting_value=setting_value,
                category=category.lower().strip(),
                description=description,
                updated_by=updated_by_id,
                updated_at=now,
            )
            self._session.add(new_setting)
            return new_setting
