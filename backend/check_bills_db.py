import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check_bills():
    load_dotenv()
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    bills = await db.bills.find().to_list(100)
    print(f"Total Bills: {len(bills)}")
    for b in bills:
        print(f"Bill: {b.get('bill_no')} for Project: {b.get('project')}")

if __name__ == "__main__":
    asyncio.run(check_bills())
