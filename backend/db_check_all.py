import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    c = AsyncIOMotorClient('mongodb://localhost:27017')
    dbs = await c.list_database_names()
    print("Databases:", dbs)
    for db_name in dbs:
        db = c[db_name]
        colls = await db.list_collection_names()
        print(f"DB: {db_name} -> Colls: {colls}")
    c.close()

if __name__ == "__main__":
    asyncio.run(check())
