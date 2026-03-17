
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def manual_approve():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    # Try to find the specific DPR from the screenshot (15 Mar 2026, Lakshmi)
    project = await db.projects.find_one({"name": {"$regex": "Lakshmi", "$options": "i"}})
    if not project:
        print("Project not found")
        return
    
    pid = str(project["_id"])
    dprs = project.get("dprs", [])
    target_dpr = next((d for d in dprs if d.get("date") == "15 Mar 2026" and d.get("status") == "Pending"), None)
    
    if not target_dpr:
        print("DPR not found")
        return
    
    did = target_dpr.get("id")
    print(f"Found DPR: {did} in Project: {pid}")
    
    # Simulate the update call
    result = await db.projects.update_one(
        {"_id": ObjectId(pid), "dprs.id": did},
        {"$set": {"dprs.$.status": "Approved"}}
    )
    
    print(f"Matched count: {result.matched_count}")
    print(f"Modified count: {result.modified_count}")

if __name__ == "__main__":
    asyncio.run(manual_approve())
