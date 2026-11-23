import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()
pg_url = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")

async def main():
    print(f"Connecting to: {pg_url.split('@')[-1] if '@' in pg_url else pg_url}")
    conn = await asyncpg.connect(pg_url)
    tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
    table_names = [t['table_name'] for t in tables]
    print("\nTables in Supabase DB:")
    for t in table_names:
        print("  -", t)
    
    required_tables = [
        "rfq_sessions", "foundry_items", "machining_items", "vendor_items",
        "purchase_items", "heat_treat_items", "competition_data", "export_shipment",
        "cost_report_materials", "cost_report_machines", "standard_ph_charges", "shipping_routes"
    ]
    missing = [t for t in required_tables if t not in table_names]
    if missing:
        print("\nMISSING TABLES:", missing)
    else:
        print("\nALL REQUIRED TABLES ARE PRESENT IN SUPABASE DB!")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
