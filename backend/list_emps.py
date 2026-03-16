
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def list_employees():
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.civil_erp
    emps = await db.employees.find().to_list(100)
    for e in emps:
        print(str(e))

if __name__ == "__main__":
    asyncio.run(list_employees())
