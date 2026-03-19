
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def list_collections():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    print(f"Checking DB: {db_name}")
    collections = await db.list_collection_names()
    print(f"Collections: {collections}")
    
    projects = await db.projects.find({}, {"name": 1}).to_list(100)
    for p in projects:
        print(f"Project: '{p.get('name')}', ID: {p['_id']}")

if __name__ == "__main__":
    asyncio.run(list_collections())
