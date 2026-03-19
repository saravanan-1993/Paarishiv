
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def debug_dprs():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    projects = await db.projects.find({}).to_list(1000)
    
    for p in projects:
        dprs = p.get("dprs", [])
        pname = p.get("name", "Unknown")
        pid = str(p["_id"])
        
        for i, dpr in enumerate(dprs):
            did = dpr.get("id")
            status = dpr.get("status")
            if not did:
                print(f"MISSING ID: Project='{pname}' ({pid}), Index={i}, Status={status}")
            elif status == "Pending":
                print(f"PENDING DPR: Project='{pname}' ({pid}), ID='{did}', Date='{dpr.get('date')}'")

if __name__ == "__main__":
    asyncio.run(debug_dprs())
