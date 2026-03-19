
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    mreqs = await db.manpower_requests.find({}).to_list(100)
    for r in mreqs:
        status = r.get('status')
        print(f"Status: '{status}', length: {len(status) if status else 0}")

if __name__ == "__main__":
    asyncio.run(check())
