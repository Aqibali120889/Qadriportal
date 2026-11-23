import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.excel.supabase_client import get_supabase

def test_all():
    sb = get_supabase()
    # 1. Fetch sessions
    sessions = sb.table("rfq_sessions").select("id, rfq_number").execute()
    print("1. RFQ Sessions:", len(sessions.data))
    if not sessions.data:
        print("FAIL: No RFQ sessions")
        return
    rfq_id = sessions.data[0]["id"]
    print("   Testing with RFQ ID:", rfq_id)
    
    # 2. Test CostWorkSheet tables
    foundry = sb.table("foundry_items").select("*").eq("rfq_id", rfq_id).execute()
    machining = sb.table("machining_items").select("*").eq("rfq_id", rfq_id).execute()
    vendor = sb.table("vendor_items").select("*").eq("rfq_id", rfq_id).execute()
    purchase = sb.table("purchase_items").select("*").eq("rfq_id", rfq_id).execute()
    heat = sb.table("heat_treat_items").select("*").eq("rfq_id", rfq_id).execute()
    comp = sb.table("competition_data").select("*").eq("rfq_id", rfq_id).execute()
    print(f"2. Cost Work Sheet items -> Foundry: {len(foundry.data)}, Machining: {len(machining.data)}, Vendor: {len(vendor.data)}, Purchase: {len(purchase.data)}, Heat: {len(heat.data)}, Competition: {len(comp.data)}")
    
    # 3. Test Export Shipment tab
    exp = sb.table("export_shipment").select("*").eq("rfq_id", rfq_id).execute()
    print("3. Export Shipment records:", len(exp.data))
    
    # 4. Test Cost Report tab (materials and machines)
    mats = sb.table("cost_report_materials").select("*").execute()
    macs = sb.table("cost_report_machines").select("*").execute()
    print(f"4. Cost Report -> Materials: {len(mats.data)}, Machines: {len(macs.data)}")
    
    # 5. Test P&H Charges tab
    ph = sb.table("standard_ph_charges").select("*").execute()
    print("5. P&H Charges:", len(ph.data))
    
    # 6. Test Shipping tab
    ship = sb.table("shipping_routes").select("*").execute()
    print("6. Shipping Routes:", len(ship.data))
    
    print("\nALL 5 TABS & BACKEND DATABASE TABLES OPERATIONAL!")

if __name__ == "__main__":
    test_all()
