import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def list_and_clear():
    load_dotenv()
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = "civil_erp"
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    collections = await db.list_collection_names()
    print(f"DEBUG: All collections: {collections}")
    
    # We want to clear ANYTHING that is not settings, roles, or employees.
    keep = ["settings", "roles", "employees"]
    
    for col in collections:
        if col not in keep:
            count = await db[col].count_documents({})
            print(f"Clearing {col} (Count: {count})...")
            await db[col].drop()
            
    # Also verify if 'projects' specifically exists
    projects_count = await db.projects.count_documents({})
    print(f"Projects count after clear: {projects_count}")

if __name__ == "__main__":
    asyncio.run(list_and_clear())
