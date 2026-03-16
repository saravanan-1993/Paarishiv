
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def dump_all_dprs():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    projects = await db.projects.find({}, {"name": 1, "dprs": 1}).to_list(100)
    
    with open("all_dprs_dump.txt", "w", encoding="utf-8") as f:
        for p in projects:
            f.write(f"Project: {p.get('name')} (ID: {p['_id']})\n")
            for dpr in p.get("dprs", []):
                f.write(f"  DPR: ID={dpr.get('id')}, Date='{dpr.get('date')}', Status={dpr.get('status')}, By={dpr.get('submitted_by')}\n")
            f.write("-" * 40 + "\n")

if __name__ == "__main__":
    asyncio.run(dump_all_dprs())
