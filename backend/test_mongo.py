import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME")
    print(f"Connecting to {url}...")
    try:
        client = AsyncIOMotorClient(url)
        db = client[db_name]
        projects = await db.projects.count_documents({})
        print(f"Success! Count: {projects}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
