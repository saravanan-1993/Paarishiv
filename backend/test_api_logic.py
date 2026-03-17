
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    status = "Approved"
    query = {"status": {"$regex": f"^{status}$", "$options": "i"}}
    
    manpower = await db.manpower_requests.find(query).sort("_id", -1).to_list(100)
    print(f"Count: {len(manpower)}")
    for mp in manpower:
        print(f"MP: {mp.get('project_name')} - {mp.get('status')}")

if __name__ == "__main__":
    asyncio.run(check())
