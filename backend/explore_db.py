import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(url)
    db_names = await client.list_database_names()
    print(f"Databases: {db_names}")
    
    for db_name in db_names:
        if db_name in ["admin", "local", "config"]: continue
        db = client[db_name]
        cols = await db.list_collection_names()
        print(f"DB: {db_name}, Collections: {cols}")
        if "users" in cols:
            users = await db.users.find().to_list(5)
            print(f"  Users in {db_name}: {[u.get('username') for u in users]}")

if __name__ == "__main__":
    asyncio.run(main())
