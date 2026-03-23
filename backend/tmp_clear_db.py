import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def clear_database():
    load_dotenv()
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = "civil_erp"
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Collections to KEEP (essential for system operation/setup)
    # We keep settings for Company Profile and roles for RBAC
    keep_collections = ["settings", "roles"] 
    
    # Note: If the user wants to clear employees too, we can. 
    # But usually, keeping the users list is safer.
    # However, for a "fresh start" in ERP, they might want to clear employees too.
    # I will KEEP employees for now, or maybe only keep the 'admin' if it exists in employees.
    # Actually, hardcoded demo users are available, so clearing employees is semi-safe.
    # Let's keep employees to be safe.
    keep_collections.append("employees")

    collections = await db.list_collection_names()
    print(f"Current collections: {collections}")
    
    for col in collections:
        if col not in keep_collections:
            print(f"Clearing collection: {col}")
            await db[col].drop()
            # Or await db[col].delete_many({}) if we want to keep indexes
            # Dropping is cleaner for a full reset.
            
    print("Database operational data cleared successfully.")

if __name__ == "__main__":
    asyncio.run(clear_database())
