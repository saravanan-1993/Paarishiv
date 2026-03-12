import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    print("--- PURCHASE ORDERS ---")
    async for po in db.purchase_orders.find():
        print(f"PO ID: {po.get('_id')}")
        print(f"  Vendor: {po.get('vendor_name')}")
        print(f"  Project: '{po.get('project_name')}'")
        print(f"  Status: '{po.get('status')}'")
        
    print("\n--- PROJECTS ---")
    async for p in db.projects.find():
         print(f"Name: '{p.get('name')}', EngID: '{p.get('engineer_id')}'")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())
