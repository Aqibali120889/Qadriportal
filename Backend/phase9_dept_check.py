"""
phase9_dept_check.py
─────────────────────────────────────────────────────────────
Cross-check notification department_ids against actual departments table.
Verifies no orphaned notifications exist and routes are populated.
"""
import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()
import asyncpg

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)

    print("=" * 60)
    print("  Phase 9 -- Dept / Route / Duplicate Check")
    print("=" * 60)

    # 1. Departments in DB
    depts = await conn.fetch("SELECT id, name, code FROM departments ORDER BY name")
    print(f"\n[1] Departments ({len(depts)}):")
    for d in depts:
        print(f"  {str(d['id'])[:8]}...  {d['code']:20s} {d['name']}")

    # 2. Notifications by dept
    by_dept = await conn.fetch("""
        SELECT department_id, COUNT(*) AS cnt,
               SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) AS unread
        FROM notifications
        GROUP BY department_id
        ORDER BY cnt DESC
    """)
    print(f"\n[2] Notifications per department:")
    dept_map = {str(d["id"]): d["code"] for d in depts}
    for r in by_dept:
        dept_id = str(r["department_id"]) if r["department_id"] else "NULL"
        dept_code = dept_map.get(dept_id, "??? orphaned")
        print(f"  dept={dept_id[:8]}... ({dept_code:20s})  total={r['cnt']:3d}  unread={r['unread']}")

    # 3. Missing routes
    no_route = await conn.fetchval("""
        SELECT COUNT(*) FROM notifications WHERE route IS NULL
    """)
    print(f"\n[3] Notifications with no route: {no_route}")

    # 4. Event type breakdown
    by_event = await conn.fetch("""
        SELECT event_type, COUNT(*) AS cnt
        FROM notifications
        GROUP BY event_type
        ORDER BY cnt DESC
    """)
    print(f"\n[4] Event type breakdown:")
    for r in by_event:
        print(f"  {str(r['event_type'] or 'NULL'):35s}  cnt={r['cnt']}")

    # 5. Potential duplicates (same event_type + project_id within 5s)
    dupes = await conn.fetch("""
        SELECT event_type, project_id, COUNT(*) AS cnt
        FROM notifications
        WHERE project_id IS NOT NULL
        GROUP BY event_type, project_id
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 10
    """)
    if dupes:
        print(f"\n[5] Potential duplicates (same event+project):")
        for r in dupes:
            print(f"  event={r['event_type']:30s}  project={str(r['project_id'])[:8]}...  count={r['cnt']}")
    else:
        print(f"\n[5] Duplicate check: PASS -- no duplicate event+project pairs")

    await conn.close()
    print("\n" + "=" * 60)

asyncio.run(main())
