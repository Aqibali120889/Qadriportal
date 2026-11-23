"""
phase9_verify.py
────────────────────────────────────────────────────────────
Quick live-DB verification for Phase 9 Notifications.

Checks:
  1. notifications table columns (all 12 expected present)
  2. idx_notifications_dept_unread_created index
  3. notification_type enum values
  4. Unread count query
  5. Recent notifications sample
"""
import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()
import asyncpg

EXPECTED_COLS = {
    "id", "user_id", "department_id", "project_id",
    "title", "message", "notification_type", "is_read",
    "created_at", "event_type", "route", "read_at", "metadata",
}

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    print("=" * 60)
    print("  Phase 9 — Notifications Table Verification")
    print("=" * 60)

    # 1. Column check
    cols = await conn.fetch("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notifications'
        ORDER BY ordinal_position
    """)
    found_cols = {r["column_name"] for r in cols}
    print(f"\n[1] Columns present ({len(cols)} total):")
    for r in cols:
        nullable = "NULL" if r["is_nullable"] == "YES" else "NOT NULL"
        status = "OK" if r["column_name"] in EXPECTED_COLS else "??"
        print(f"  [{status}] {r['column_name']:35s} {r['data_type']:20s} {nullable}")

    missing = EXPECTED_COLS - found_cols
    if missing:
        print(f"\n  FAIL: MISSING columns: {missing}")
    else:
        print("\n  PASS: All 13 expected columns present")

    # 2. Index check
    idx = await conn.fetchrow("""
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'notifications'
        AND indexname = 'idx_notifications_dept_unread_created'
    """)
    print(f"\n[2] Performance index: {'PASS: EXISTS' if idx else 'FAIL: MISSING -- run migration 0004'}")

    # 3. notification_type enum
    enum_vals = await conn.fetch("""
        SELECT e.enumlabel
        FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'notification_type'
        ORDER BY e.enumsortorder
    """)
    print(f"\n[3] notification_type enum: {[r['enumlabel'] for r in enum_vals]}")

    # 4. Row counts
    total = await conn.fetchval("SELECT COUNT(*) FROM notifications")
    unread = await conn.fetchval("SELECT COUNT(*) FROM notifications WHERE is_read = false")
    print(f"\n[4] Row counts: total={total}  unread={unread}")

    # 5. Recent 5 notifications
    recent = await conn.fetch("""
        SELECT event_type, notification_type, is_read, department_id, created_at
        FROM notifications
        ORDER BY created_at DESC
        LIMIT 5
    """)
    print(f"\n[5] Recent notifications ({len(recent)} shown):")
    for r in recent:
        status = "UNREAD" if not r["is_read"] else "read"
        dept = str(r["department_id"])[:8] + "..." if r["department_id"] else "broadcast"
        print(f"  [{status}] {str(r['event_type'] or 'N/A'):30s} type={r['notification_type']:8s} dept={dept}")

    await conn.close()
    print("\n" + "=" * 60)
    print("  Verification complete")
    print("=" * 60)

asyncio.run(main())
