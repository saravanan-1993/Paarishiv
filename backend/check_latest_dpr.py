
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from json import dumps
from bson import json_util
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
        if dprs:
            # Sort by date / created_at DESC
            dprs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            latest = dprs[0]
            print(f"Project: {p.get('name')}")
            print(f"Latest DPR: {latest.get('date')}")
            print(f"Next Day Labour: {latest.get('next_day_labour')}")

if __name__ == "__main__":
    asyncio.run(check())
