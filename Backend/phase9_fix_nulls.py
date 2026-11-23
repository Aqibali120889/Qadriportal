"""
phase9_fix_nulls.py
─────────────────────────────────────────────────────────────
One-time fix: set default route/event_type on notifications
that have NULL values (pre-Phase-9 rows or bad writes).
"""
import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()
import asyncpg

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)

    # Fix NULL event_type: label as 'legacy' so it's recognizable in history feeds
    r1 = await conn.execute("""
        UPDATE notifications
        SET event_type = 'legacy'
        WHERE event_type IS NULL
    """)
    print(f"Fixed NULL event_type rows: {r1}")

    # Fix NULL route: look up project_id and build a route from it
    null_routes = await conn.fetch("""
        SELECT n.id, n.project_id, n.department_id, d.code AS dept_code
        FROM notifications n
        LEFT JOIN departments d ON d.id = n.department_id
        WHERE n.route IS NULL
    """)
    print(f"NULL route notifications: {len(null_routes)}")
    for row in null_routes:
        pid = row["project_id"]
        dept_code = row["dept_code"] or "CE"
        if dept_code == "FOUNDRY":
            route = f"/foundry?projectId={pid}" if pid else "/foundry"
        else:
            route = f"/dashboard?projectId={pid}" if pid else "/dashboard"
        await conn.execute(
            "UPDATE notifications SET route = $1 WHERE id = $2",
            route, row["id"]
        )
        print(f"  Set route={route} on notification {str(row['id'])[:8]}...")

    # Verify
    remaining = await conn.fetchval("SELECT COUNT(*) FROM notifications WHERE route IS NULL OR event_type IS NULL")
    print(f"\nRemaining NULL route/event_type: {remaining}")
    if remaining == 0:
        print("PASS: all notifications have route and event_type")
    else:
        print(f"FAIL: {remaining} notifications still have NULL values")

    await conn.close()

asyncio.run(main())
