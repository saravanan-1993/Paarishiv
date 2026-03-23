import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def list_dbs():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db_names = await client.list_database_names()
    print(f"Databases found: {db_names}")
    
    for db_name in db_names:
        if db_name in ['admin', 'config', 'local']:
            continue
        print(f"\n--- Checking DB: {db_name} ---")
        db = client[db_name]
        collections = await db.list_collection_names()
        for coll in collections:
            count = await db[coll].count_documents({})
            if count > 0:
                print(f"  [{coll}]: {count} docs")

if __name__ == "__main__":
    asyncio.run(list_dbs())
