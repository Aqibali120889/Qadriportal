"""
Phase 1 — Reflect existing schema (non-destructive)

Revision ID: 0001
Revises: 
Create Date: 2026-07-17

This migration does NOT create or alter any tables.
The Supabase PostgreSQL database already contains all required tables
(created via the Supabase dashboard / prior migrations).

Purpose:
1. Establish Alembic revision history baseline
2. Document all Phase 1 table dependencies
3. Provide a safe starting point for future schema migrations

All required enum types are already present in the live DB:
  - project_status:   DRAFT | ACTIVE | ON_HOLD | COMPLETED | CANCELLED
  - email_status:     RECEIVED | SENT | DRAFT | FAILED
  - file_status:      UPLOADING | AVAILABLE | PROCESSING | ARCHIVED | DELETED
  - file_type:        PDF | DWG | DXF | STEP | IMAGE | XLSX | DOCX | ZIP | OTHER
  - conversation_type: CUSTOMER | INTERNAL | VENDOR

Phase 1 tables in use:
  - public.projects
  - public.conversations
  - public.emails
  - public.email_attachments
  - public.files
  - public.file_versions
  - public.drawings
"""

from __future__ import annotations

from alembic import op


# revision identifiers
revision: str = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    No-op: all tables already exist in Supabase.
    This revision marks the baseline for future migrations.
    """
    pass


def downgrade() -> None:
    """
    No-op: baseline revision — nothing to undo.
    """
    pass
