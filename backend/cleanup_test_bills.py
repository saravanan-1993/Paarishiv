import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def cleanup_test_bills():
    load_dotenv()
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Delete bills with RA-DEBUG or RA-TEST
    result = await db.bills.delete_many({
        "bill_no": {"$regex": "RA-(DEBUG|TEST|002-UNIQUE)", "$options": "i"}
    })
    print(f"Deleted {result.deleted_count} test bills")
    
    # Also delete RA-001 since it was a test
    result2 = await db.bills.delete_one({"bill_no": "RA-001"})
    print(f"Deleted RA-001: {result2.deleted_count}")

if __name__ == "__main__":
    asyncio.run(cleanup_test_bills())
