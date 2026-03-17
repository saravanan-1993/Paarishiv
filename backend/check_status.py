from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv

async def check():
    load_dotenv()
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    emp = await db.employees.find_one({"fullName": "Saravanan"})
    if emp:
        print(f"Employee Status: {emp.get('status')}")
    else:
        print("Employee not found")
        
    stats = await db.employees.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(100)
    print("Employee statuses in DB:")
    for s in stats:
        print(f" - {s['_id']}: {s['count']}")

if __name__ == "__main__":
    asyncio.run(check())
