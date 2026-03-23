
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from json import dumps
from bson import json_util
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    mreqs = await db.manpower_requests.find({}).to_list(100)
    print(dumps(mreqs, indent=2, default=json_util.default))

if __name__ == "__main__":
    asyncio.run(check())
