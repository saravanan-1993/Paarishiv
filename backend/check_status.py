
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load from the same dir
load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    print(f"Connecting to: {url} -> {db_name}")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    count = await db.projects.count_documents({})
    print(f"Total projects in DB: {count}")
    
    projects = await db.projects.find({}).to_list(100)
    for p in projects:
        dprs = p.get("dprs", [])
        print(f"Project: {p.get('name')} (ID: {p.get('_id')}), DPR count: {len(dprs)}")
        for d in dprs:
            ndl = d.get("next_day_labour", [])
            if ndl:
                print(f"  - DPR Date: {d.get('date')}, Next Day Labour: {ndl}")

    mreqs = await db.manpower_requests.find({}).to_list(100)
    print(f"\nTotal Manpower Requests in DB: {len(mreqs)}")
    for r in mreqs:
        print(f"  - ID: {r.get('_id')}, Project: {r.get('project_name')}, Status: {r.get('status')}")

if __name__ == "__main__":
    asyncio.run(check())
