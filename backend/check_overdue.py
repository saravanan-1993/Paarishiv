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
        project = await db.projects.find_one({"name": {"$regex": "DHFL Homes"}})
        if project:
            print(f"Project: {project['name']}")
            for t in project.get("tasks", []):
                print(f"Task: {t.get('name')}, Status: {t.get('status')}, Due: {t.get('dueDate')} {t.get('dueTime')}")
        else:
            print("Project not found")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())
