import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db = client["civil_erp"]
    try:
        projects = await db.projects.find({}, {"name": 1, "engineer_id": 1}).to_list(100)
        print("Projects found:")
        for p in projects:
            print(f"- Name: {p.get('name')}, Engineer ID: {p.get('engineer_id')}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())
