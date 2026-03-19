import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def list_collections():
    load_dotenv()
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = "civil_erp"
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    collections = await db.list_collection_names()
    print("Found collections:")
    for col in collections:
        print(f"- {col}")

if __name__ == "__main__":
    asyncio.run(list_collections())
