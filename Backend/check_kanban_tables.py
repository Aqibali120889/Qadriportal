import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()
import asyncpg

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    
    tables = ["kanban_tasks", "task_comments", "task_history"]
    for t in tables:
        cols = await conn.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", t
        )
        if not cols:
            print(f"MISSING TABLE: {t}")
        else:
            names = [r["column_name"] for r in cols]
            print(f"TABLE {t}: {names}")
    
    # Check project table columns
    proj_cols = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='projects' ORDER BY ordinal_position"
    )
    print(f"PROJECT cols: {[r['column_name'] for r in proj_cols]}")
    
    # Count rows
    for t in tables:
        try:
            cnt = await conn.fetchval(f"SELECT COUNT(*) FROM {t}")
            print(f"{t} count: {cnt}")
        except Exception as e:
            print(f"{t} ERROR: {e}")
    
    # Check projects count and sample
    proj_cnt = await conn.fetchval("SELECT COUNT(*) FROM projects")
    print(f"projects total: {proj_cnt}")
    
    sample = await conn.fetch("SELECT id, job_number, rfq_number, title, current_department_id FROM projects LIMIT 5")
    for r in sample:
        print(f"  project: job={r['job_number']} rfq={r['rfq_number']} dept={str(r['current_department_id'])[:8] if r['current_department_id'] else 'None'}")

    await conn.close()

asyncio.run(main())
