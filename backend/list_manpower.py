
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
    
    mreqs = await db.manpower_requests.find({}).to_list(100)
    print(f"Total Manpower Requests: {len(mreqs)}")
    for r in mreqs:
        print(f"ID: {r.get('_id')}")
        print(f"  Project: {r.get('project_name')}")
        print(f"  Status: {r.get('status')}")
        print(f"  Date: {r.get('created_at')}")
        print(f"  Roles: {r.get('requested_items')}")

if __name__ == "__main__":
    asyncio.run(check())
