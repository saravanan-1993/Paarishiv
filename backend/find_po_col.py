import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    dbs = await client.list_database_names()
    
    for db_name in dbs:
        db = client[db_name]
        cols = await db.list_collection_names()
        for col in cols:
            if 'purchase' in col or 'po' in col:
                count = await db[col].count_documents({})
                print(f"FOUND: DB: {db_name}, Col: {col}, Count: {count}")
                if count > 0:
                     async for doc in db[col].find().limit(1):
                         print(f"  Example: {doc}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())
