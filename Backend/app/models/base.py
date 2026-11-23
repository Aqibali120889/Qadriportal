"""
app/models/base.py
─────────────────────────────────────────────────────────────────────────────
SQLAlchemy declarative base.
All ORM models inherit from this single Base to share the same metadata registry.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Project-wide SQLAlchemy declarative base."""
    pass
