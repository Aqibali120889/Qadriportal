"""
Phase 2 — Identity, Authentication & Department Workspace Isolation

Revision ID: 0002
Revises:     0001
Create Date: 2026-07-21

Schema changes in this migration:
  1. ADD COLUMN notifications.department_id UUID NULL → departments.id
     Reason: notifications must be department-scoped for workspace isolation.
             Phase 2 requires GET /notifications to automatically filter by
             the requesting user's department. Without this column, every
             notification query would require a costly join through
             user_id → users.department_id. A direct FK enables efficient
             indexed queries: WHERE department_id = :dept_id.

  2. CREATE INDEX idx_notifications_department_id
     Reason: All protected notification queries filter by department_id.
             Index prevents full table scans on a potentially large table.

All other Phase 2 tables (users, departments, roles, permissions,
role_permissions, user_sessions, login_history, security_events,
entity_audit_logs) already exist in the live Supabase database.

No tables are dropped or renamed. This migration is fully additive
and backward-compatible with Phase 1.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add notifications.department_id column and index.
    Uses IF NOT EXISTS to be idempotent — safe to run multiple times.
    """
    # ── notifications.department_id ───────────────────────────────────────────
    op.execute(
        """
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS department_id UUID
        REFERENCES departments(id) ON DELETE SET NULL;
        """
    )

    # ── Index for department-scoped notification queries ──────────────────────
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_department_id
        ON notifications(department_id);
        """
    )


def downgrade() -> None:
    """
    Remove the index and column added in this migration.
    Safe to run — does not affect any Phase 1 data.
    """
    op.execute(
        "DROP INDEX IF EXISTS idx_notifications_department_id;"
    )
    op.execute(
        "ALTER TABLE notifications DROP COLUMN IF EXISTS department_id;"
    )
