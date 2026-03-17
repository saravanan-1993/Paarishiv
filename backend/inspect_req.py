
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
    
    # Just list every single field of a manpower request
    req = await db.manpower_requests.find_one({})
    if req:
        print("Fields in manpower_request:")
        for k, v in req.items():
            print(f"  {k}: {v} ({type(v)})")
    else:
        print("No manpower requests found!")

if __name__ == "__main__":
    asyncio.run(check())
