import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def clear_database():
    load_dotenv()
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")
    
    print(f"Connecting to: {MONGODB_URL.split('@')[-1] if '@' in MONGODB_URL else MONGODB_URL}")
    print(f"Target Database: {DATABASE_NAME}")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # List of collections to clear
    collections = [
        "projects", "bills", "expenses", "grns", 
        "purchase_orders", "vendors", "inventory", 
        "labour", "employees", "attendance", "receipts"
    ]
    
    for collection in collections:
        result = await db[collection].delete_many({})
        print(f"  - {collection}: Deleted {result.deleted_count} documents")
    
    print("\nDatabase reset successful. User accounts preserved.")

if __name__ == "__main__":
    asyncio.run(clear_database())
