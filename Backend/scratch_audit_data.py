import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import get_settings

settings = get_settings()

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        print("=== EMAILS SAMPLE ROWS ===")
        res = await conn.execute(text("SELECT id, subject, sender_email, project_id FROM public.emails LIMIT 10;"))
        rows = res.fetchall()
        print(f"Total emails in DB: {len(rows)}")
        for r in rows:
            print(" ", r)

        print("\n=== PROJECTS SAMPLE ROWS ===")
        res = await conn.execute(text("SELECT id, job_number, title, current_department_id, status FROM public.projects;"))
        rows = res.fetchall()
        print(f"Total projects in DB: {len(rows)}")
        for r in rows:
            print(" ", r)

        print("\n=== NOTIFICATIONS SAMPLE ROWS ===")
        res = await conn.execute(text("SELECT id, title, notification_type, department_id FROM public.notifications;"))
        rows = res.fetchall()
        print(f"Total notifications in DB: {len(rows)}")
        for r in rows:
            print(" ", r)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
