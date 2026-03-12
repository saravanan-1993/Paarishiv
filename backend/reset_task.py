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
        from bson import ObjectId
        # Reset task to In Progress so scheduler can re-process
        await db.projects.update_one(
            {"name": {"$regex": "DHFL Homes"}, "tasks.name": {"$regex": "Foundation work"}},
            {"$set": {"tasks.$.status": "In Progress"}}
        )
        print("Task status reset to 'In Progress' for DHFL Homes.")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())
