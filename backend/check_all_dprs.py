
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
    
    projects = await db.projects.find({}).to_list(100)
    for p in projects:
        dprs = p.get("dprs", [])
        print(f"Project: {p.get('name')}")
        for d in dprs:
            ndl = d.get("next_day_labour", [])
            print(f"  [{d.get('date')}] Next Day Labour: {ndl}")

if __name__ == "__main__":
    asyncio.run(check())
