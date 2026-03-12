
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def list_dbs():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    try:
        dbs = await client.list_database_names()
        print(f"Databases: {dbs}")
        for db_name in dbs:
            db = client[db_name]
            collections = await db.list_collection_names()
            print(f"DB: {db_name}, Collections: {collections}")
            if "projects" in collections:
                count = await db.projects.count_documents({})
                print(f"  Count in projects: {count}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(list_dbs())
