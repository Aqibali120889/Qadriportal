import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.excel.supabase_client import get_supabase

def main():
    sb = get_supabase()
    # 1. Get first RFQ session ID
    res = sb.table("rfq_sessions").select("id").limit(1).execute()
    if not res.data:
        print("No RFQ session found!")
        return
    rfq_id = res.data[0]["id"]
    print("Testing insert with rfq_id:", rfq_id)
    
    # 2. Insert foundry item with list parameter modified_fields: []
    ins = sb.table("foundry_items").insert({
        "rfq_id": rfq_id,
        "row_order": 999,
        "qty": 1,
        "item_name": "Test Item",
        "branch": "QBL II",
        "source": "manual",
        "is_modified": False,
        "modified_fields": []
    }).execute()
    
    print("Insert success! Created item:", ins.data[0] if ins.data else "None")
    
    # 3. Clean up test row
    if ins.data:
        item_id = ins.data[0]["id"]
        sb.table("foundry_items").delete().eq("id", item_id).execute()
        print("Cleaned up test item:", item_id)

if __name__ == "__main__":
    main()
