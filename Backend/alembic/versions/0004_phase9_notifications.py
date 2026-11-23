"""
Phase 9 — Enterprise Notification System

Revision ID: 0004
Revises:     0003
Create Date: 2026-07-28

Adds 4 nullable columns to the existing `notifications` table so a single
centralized NotificationService can drive both the real-time Bell dropdown
and (by already being unioned into HistoryRepository.get_department_feed())
the History feed, without any new tables or duplicated data:

  event_type  VARCHAR(100)  — specific event kind ("ai_completed",
                              "human_review_required", "email_received", ...),
                              kept separate from the existing notification_type
                              severity enum (INFO/SUCCESS/WARNING/ERROR/TASK).
  route       VARCHAR(500)  — precomputed frontend path, written once at
                              creation time so the frontend needs no
                              event->route mapping of its own.
  read_at     TIMESTAMPTZ   — when the notification was marked read.
  metadata    JSONB         — optional structured payload (entity counts,
                              error text, etc.).

rfq_number is deliberately NOT added here — it's already reachable via
project_id -> projects.rfq_number and is joined at read time, not duplicated.

All columns are nullable and additive. No existing column, table, or row is
modified. Fully backward compatible with Phases 1-8.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add event_type, route, read_at, metadata to notifications.
    Uses IF NOT EXISTS — idempotent, safe to run multiple times.
    """
    op.execute(
        """
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
        ADD COLUMN IF NOT EXISTS route VARCHAR(500),
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS metadata JSONB;
        """
    )

    # Notifications are always queried filtered by department + unread-first,
    # ordered by recency — index the common access pattern.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_dept_unread_created
        ON notifications(department_id, is_read, created_at DESC);
        """
    )


def downgrade() -> None:
    """
    Remove the index and columns added in this migration.
    Safe to run — does not affect any pre-Phase-9 data.
    """
    op.execute(
        "DROP INDEX IF EXISTS idx_notifications_dept_unread_created;"
    )
    op.execute(
        """
        ALTER TABLE notifications
        DROP COLUMN IF EXISTS event_type,
        DROP COLUMN IF EXISTS route,
        DROP COLUMN IF EXISTS read_at,
        DROP COLUMN IF EXISTS metadata;
        """
    )
