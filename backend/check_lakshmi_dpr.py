
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_specific_dpr():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    # Let's find project by part of the name to be safe
    project = await db.projects.find_one({"name": {"$regex": "Lakshmi", "$options": "i"}})
    if not project:
        print("Lakshmi project not found")
        return
    
    print(f"Project Name: {project.get('name')}")
    print(f"Project ID: {project['_id']}")
    
    dprs = project.get('dprs', [])
    print(f"Total DPRs: {len(dprs)}")
    
    for dpr in dprs:
        if dpr.get('status') == 'Pending':
            print(f"PENDING DPR: ID={dpr.get('id')}, Date={dpr.get('date')}, SubmittedBy={dpr.get('submitted_by')}")

if __name__ == "__main__":
    asyncio.run(check_specific_dpr())
