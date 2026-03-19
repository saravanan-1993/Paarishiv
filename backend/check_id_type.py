
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    req = await db.manpower_requests.find_one({})
    if req:
        _id = req.get('_id')
        print(f"ID: {_id}")
        print(f"Type of ID: {type(_id)}")
        print(f"Is ObjectId: {isinstance(_id, ObjectId)}")

if __name__ == "__main__":
    asyncio.run(check())
