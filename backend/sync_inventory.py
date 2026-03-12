from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

async def sync_inventory():
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client["civil_erp"]
    
    # Clear current inventory to rebuild it correctly
    await db.inventory.delete_many({})
    
    # Fetch all GRNs
    grns = await db.grns.find().to_list(1000)
    
    print(f"Syncing inventory from {len(grns)} GRNs...")
    
    count = 0
    for grn in grns:
        po_id = grn.get("po_id")
        project_name = "Unknown"
        
        if po_id and ObjectId.is_valid(po_id):
            po = await db.purchase_orders.find_one({"_id": ObjectId(po_id)})
            if po:
                project_name = po.get("project_name", "Unknown")
        
        for item in grn.get("items", []):
            await db.inventory.update_one(
                {
                    "project_name": project_name,
                    "material_name": item.get("name")
                },
                {
                    "$inc": {"stock": float(item.get("received_qty", 0))},
                    "$set": {"unit": item.get("unit", "Nos")}
                },
                upsert=True
            )
            count += 1
            print(f"  - Updated {item.get('name')} for {project_name}: +{item.get('received_qty')}")
            
    print(f"Done! {count} updates processed.")

if __name__ == "__main__":
    asyncio.run(sync_inventory())
