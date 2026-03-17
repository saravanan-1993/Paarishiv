from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv

async def run():
    load_dotenv()
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    result = await db.employees.update_many(
        {"fullName": "Saravanan"},
        {"$set": {"status": "Active"}}
    )
    print(f"Updated {result.modified_count} employees to Active")

if __name__ == "__main__":
    asyncio.run(run())
