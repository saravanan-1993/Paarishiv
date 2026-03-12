
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import json

async def list_projects():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["civil_erp"]
    
    try:
        projects = await db.projects.find({}, {"name": 1, "_id": 1}).to_list(10)
        for p in projects:
            print(f"Name: {p.get('name')}, ID: {str(p['_id'])}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(list_projects())
