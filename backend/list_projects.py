
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check_projects():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.civil_erp # Let's verify DB name too
    
    projects = await db.projects.find({}, {"name": 1}).to_list(100)
    for p in projects:
        print(f"Project: '{p.get('name')}', ID: {p['_id']}")

if __name__ == "__main__":
    asyncio.run(check_projects())
