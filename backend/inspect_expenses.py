import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def inspect():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["civil_erp"]
    pos = await db.expenses.find().to_list(100)
    for p in pos[-5:]:
        print(p)

asyncio.run(inspect())
