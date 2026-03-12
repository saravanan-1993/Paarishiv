import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    print(f"Connecting to {url}")
    client = AsyncIOMotorClient(url)
    db = client["civil_erp"]
    try:
        p_count = await db.projects.count_documents({})
        print(f"Projects count: {p_count}")
        if p_count > 0:
            sample = await db.projects.find_one()
            print("Sample project keys:", sample.keys())
            # print("Sample project Tasks length:", len(sample.get("tasks", [])))
        
        cols = await db.list_collection_names()
        print(f"Collections: {cols}")
        
    except Exception as e:
        print(f"Database error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())
