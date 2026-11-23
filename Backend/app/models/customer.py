"""
app/models/customer.py
─────────────────────────────────────────────────────────────────────────────
ORM model for the `customers` table.

Phase 11 addition. The `projects` table already has a customer_id UUID column
that references this table. Columns reflected from the live Supabase DB.

Actual columns (verified 2026-08-05):
  id, company_name, contact_person, email, phone, address,
  country, city, notes, created_at, updated_at, deleted_at,
  created_by, updated_by
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Customer(Base):
    __tablename__ = "customers"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    company_name:    Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    contact_person:  Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email:           Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    phone:           Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address:         Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city:            Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    country:         Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes:           Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    def __repr__(self) -> str:
        return f"<Customer id={self.id} company={self.company_name!r}>"
