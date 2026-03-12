import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def check_db():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.civil_erp
    
    grns_count = await db.grns.count_documents({})
    pos_count = await db.purchase_orders.count_documents({})
    
    print(f"Total GRNs: {grns_count}")
    print(f"Total POs: {pos_count}")
    
    grns = await db.grns.find().to_list(100)
    pos = await db.purchase_orders.find().to_list(100)
    
    pos_ids = [str(p["_id"]) for p in pos]
    
    for g in grns:
        po_id = g.get("po_id")
        exists = po_id in pos_ids
        print(f"GRN ID: {g['_id']}, PO ID: {po_id}, PO Exists: {exists}, Receipt Type: {g.get('receipt_type')}")

if __name__ == "__main__":
    asyncio.run(check_db())
