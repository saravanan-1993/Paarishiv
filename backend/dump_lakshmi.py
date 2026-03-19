
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def dump_lakshmi_dprs():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    project = await db.projects.find_one({"name": {"$regex": "Lakshmi", "$options": "i"}})
    if not project:
        print("Project not found")
        return
    
    print(f"Project: {project.get('name')}")
    for dpr in project.get("dprs", []):
        print(f"DPR -> ID: {dpr.get('id')}, Date: '{dpr.get('date')}', Status: {dpr.get('status')}")

if __name__ == "__main__":
    asyncio.run(dump_lakshmi_dprs())
