
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_activity_logs():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    print(f"Checking activity logs in {db_name}...")
    cursor = db.activity_log.find({}).sort("timestamp", -1).limit(10)
    async for log in cursor:
        print(log)

if __name__ == "__main__":
    asyncio.run(check_activity_logs())
