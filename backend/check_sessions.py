
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_sessions():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    print(f"Checking sessions in {db_name}...")
    cursor = db.sessions.find({}).limit(5)
    async for doc in cursor:
        print(doc)

if __name__ == "__main__":
    asyncio.run(check_sessions())
