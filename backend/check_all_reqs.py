
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
    
    mreqs = await db.manpower_requests.find({}).sort("created_at", -1).to_list(100)
    print(f"Total: {len(mreqs)}")
    for r in mreqs:
        print(f"Date: {r.get('created_at')}, Project: {r.get('project_name')}, Status: {r.get('status')}")

if __name__ == "__main__":
    asyncio.run(check())
