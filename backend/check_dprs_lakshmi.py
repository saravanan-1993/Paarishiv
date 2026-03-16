
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from bson import ObjectId

async def check_dprs():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.civil_erp
    
    project = await db.projects.find_one({"name": "Lakshmi Developers Pvt Ltd"})
    if not project:
        print("Project not found")
        return
    
    print(f"Project ID: {project['_id']}")
    print(f"DPRs Count: {len(project.get('dprs', []))}")
    
    for dpr in project.get('dprs', []):
        print(f"DPR ID: {dpr.get('id')}, Date: {dpr.get('date')}, Status: {dpr.get('status')}")

if __name__ == "__main__":
    asyncio.run(check_dprs())
