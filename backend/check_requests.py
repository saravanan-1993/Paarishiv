
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def check_requests():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    requests = await db.material_requests.find({"status": "Pending"}).to_list(100)
    print(f"Found {len(requests)} pending requests.")
    for r in requests:
        print(f"ID: {r['_id']}, Project: {r.get('project_name')}, Date: {r.get('created_at')}")
        # Test if we can find it by ObjectId
        test_r = await db.material_requests.find_one({"_id": r["_id"]})
        print(f"  Lookup by ID success: {test_r is not None}")

if __name__ == "__main__":
    asyncio.run(check_requests())
