import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check():
    load_dotenv()
    url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    print(f"Connecting to {url}...")
    client = AsyncIOMotorClient(url)
    db = client["civil_erp"]
    try:
        colls = await db.list_collection_names()
        print(f"Connected! Collections: {colls}")
        
        # Check global_roles
        roles = await db.global_roles.find_one()
        if roles:
            print("global_roles document found.")
        else:
            print("global_roles document MISSING.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
