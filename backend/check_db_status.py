import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def check_db():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["civil_erp"]
    try:
        count = await db.projects.count_documents({})
        projects = await db.projects.find({}).to_list(5)
        print(f"Project count: {count}")
        for p in projects:
            print(f"Name: {p.get('name')}, Type: {type(p.get('_id'))}")
    except Exception as e:
        print(f"Error connecting to DB: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
