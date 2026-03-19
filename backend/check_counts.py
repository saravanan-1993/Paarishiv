
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    # Check all statuses
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    results = await db.manpower_requests.aggregate(pipeline).to_list(100)
    print("Manpower Request Status counts:")
    for r in results:
        print(f"  {r['_id']}: {r['count']}")
    
    # Also check if project_name or other fields are missing
    first = await db.manpower_requests.find_one({})
    if first:
        print(f"Sample Request: {first}")

if __name__ == "__main__":
    asyncio.run(check())
