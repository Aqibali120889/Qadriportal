import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()
import asyncpg

TABLES = [
    "ai_extractions",
    "extracted_entities", 
    "ai_processing_logs",
    "ocr_jobs",
    "workspace_field_values",
    "workspace_fields",
    "workspace_sections",
    "estimation_workspaces",
    "workspace_ai_mapping",
    "human_reviews",
    "drawing_pages",
    "drawing_annotations",
    "validation_history",
]

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    
    for t in TABLES:
        cols = await conn.fetch(f"""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '{t}'
            ORDER BY ordinal_position
        """)
        if not cols:
            print(f"\n[MISSING] {t}")
            continue
        print(f"\n=== {t} ===")
        for c in cols:
            default = f" DEFAULT={c['column_default'][:30]}" if c['column_default'] else ""
            print(f"  {c['column_name']:35s} {c['data_type']:25s} {'NULL' if c['is_nullable']=='YES' else 'NOT NULL'}{default}")
    
    # Also get ocr_jobs status enum values
    print("\n=== ocr_jobs processing_status enum ===")
    vals = await conn.fetch("""
        SELECT e.enumlabel
        FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname LIKE '%processing%' OR t.typname LIKE '%job%' OR t.typname LIKE '%ocr%'
    """)
    for v in vals:
        print(" ", v["enumlabel"])
    
    await conn.close()

asyncio.run(main())
