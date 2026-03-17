
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
    
    reg_count = await db.manpower_requests.count_documents({"status": {"$regex": "^Approved$", "$options": "i"}})
    total_count = await db.manpower_requests.count_documents({})
    
    print(f"Total: {total_count}")
    print(f"Approved (Regex): {reg_count}")

if __name__ == "__main__":
    asyncio.run(check())
