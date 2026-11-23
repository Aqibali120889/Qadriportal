import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()
import asyncpg

# Add raw_response column to ocr_jobs for storing the Modal JSON output
# Add processing_metadata for timing/model info
MIGRATIONS = [
    """
    ALTER TABLE ocr_jobs 
    ADD COLUMN IF NOT EXISTS raw_response jsonb,
    ADD COLUMN IF NOT EXISTS processing_metadata jsonb
    """,
    # Add review_status to extracted_entities so each field tracks approve/reject
    """
    ALTER TABLE extracted_entities
    ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending' 
        CHECK (review_status IN ('pending','approved','rejected'))
    """,
    # Add is_applied_to_rfq flag
    """
    ALTER TABLE extracted_entities
    ADD COLUMN IF NOT EXISTS is_applied_to_rfq boolean DEFAULT false
    """,
]

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    for sql in MIGRATIONS:
        try:
            await conn.execute(sql.strip())
            print("OK:", sql.strip()[:80])
        except Exception as e:
            print("FAIL:", str(e)[:120])
    await conn.close()
    print("\nDone.")

asyncio.run(main())
