
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_settings():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["civil_erp"]
    cursor = db.settings.find({})
    async for doc in cursor:
        print(doc)

if __name__ == "__main__":
    asyncio.run(check_settings())
