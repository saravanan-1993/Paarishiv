from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_dprs():
    print("Connecting to MongoDB Atlas...")
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client[os.getenv("DATABASE_NAME", "civil_erp")]
    
    print("Fetching projects...")
    projects = await db.projects.find({}).to_list(1000)
    print(f"Total projects found: {len(projects)}")
    
    for p in projects:
        name = p.get('name')
        dprs = p.get('dprs', [])
        print(f"\nProject: {name}")
        print(f"  DPRs Found: {len(dprs)}")
        for d in dprs:
            print(f"    - Date: {d.get('date')}, By: {d.get('submitted_by')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_dprs())
