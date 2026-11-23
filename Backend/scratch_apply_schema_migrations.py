"""
Apply Phase 6 schema migrations to Supabase database.
Adds missing columns required by the original Excel sheet analysis.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.excel.supabase_client import get_supabase

MIGRATIONS = [
    # rfq_sessions - missing fields from original sheet
    "ALTER TABLE rfq_sessions ADD COLUMN IF NOT EXISTS other_fls_royalty_pct numeric(5,4) DEFAULT 0.05",
    "ALTER TABLE rfq_sessions ADD COLUMN IF NOT EXISTS other_contingency_pct numeric(5,4) DEFAULT 0.05",
    "ALTER TABLE rfq_sessions ADD COLUMN IF NOT EXISTS other_packing_cost_per_kg numeric(10,2) DEFAULT 0",

    # export_shipment - missing fields from Export Shipment Charges sheet analysis
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS packing_weight_per_part numeric(10,2) DEFAULT 250",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS box_dimensions text",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS freight_country text",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS freight_kg_per_cbm numeric(10,2) DEFAULT 1000",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS freight_charges_per_cbm numeric(10,2)",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS freight_container_charge numeric(12,2)",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS ex_works_price_override numeric(12,2)",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS ph_charges_override numeric(12,2)",
    "ALTER TABLE export_shipment ADD COLUMN IF NOT EXISTS freight_charges_override numeric(12,2)",
]

def main():
    import asyncio
    import asyncpg
    import os

    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        # Try to read from .env
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL="):
                        db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    elif line.startswith("SUPABASE_DB_URL="):
                        db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

    if not db_url:
        print("ERROR: DATABASE_URL not found in environment or .env")
        return

    # asyncpg cannot use the SQLAlchemy driver prefix
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    async def run():
        conn = await asyncpg.connect(db_url)
        success = 0
        failed = 0
        for sql in MIGRATIONS:
            try:
                await conn.execute(sql)
                col = sql.split("ADD COLUMN IF NOT EXISTS ")[1].split(" ")[0]
                print(f"  OK: {col}")
                success += 1
            except Exception as e:
                print(f"  FAIL: {sql[:80]} -- {e}")
                failed += 1
        await conn.close()
        print(f"\nDone: {success} applied, {failed} failed")

    asyncio.run(run())

if __name__ == "__main__":
    main()
