import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def inspect_employees():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('DATABASE_NAME', 'civil_erp')]
    r = await db.employees.find_one({"fullName": {"$regex": "Gokul", "$options": "i"}})
    print(r)
    client.close()

if __name__ == "__main__":
    asyncio.run(inspect_employees())
