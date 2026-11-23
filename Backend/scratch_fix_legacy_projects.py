import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import get_settings

settings = get_settings()

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("UPDATE public.projects SET current_department_id = '11111111-1111-1111-1111-111111111111' WHERE current_department_id IS NULL;"))
        await conn.commit()
        print(f"Updated legacy projects without department: {res.rowcount} rows updated.")

        # Also insert a sample notification for testing history
        res = await conn.execute(text(
            """
            INSERT INTO public.notifications (id, title, message, notification_type, department_id, project_id, created_at)
            VALUES (
                gen_random_uuid(),
                'System Initialization',
                'Phase 3 Department Isolation active.',
                'INFO',
                '11111111-1111-1111-1111-111111111111',
                (SELECT id FROM public.projects LIMIT 1),
                NOW()
            )
            ON CONFLICT DO NOTHING;
            """
        ))
        await conn.commit()
        print("Sample notification verified.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
