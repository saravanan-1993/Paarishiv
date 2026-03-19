
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def dump_all_lakshmi():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    projects = await db.projects.find({"name": {"$regex": "Lakshmi", "$options": "i"}}).to_list(100)
    
    with open("lakshmi_dump.txt", "w", encoding="utf-8") as f:
        for p in projects:
            f.write(f"Project: {p.get('name')} (ID: {p['_id']})\n")
            for dpr in p.get("dprs", []):
                f.write(f"  DPR: ID={dpr.get('id')}, Date='{dpr.get('date')}', Status={dpr.get('status')}\n")
            f.write("-" * 40 + "\n")
    print(f"Dumped {len(projects)} projects to lakshmi_dump.txt")

if __name__ == "__main__":
    asyncio.run(dump_all_lakshmi())
