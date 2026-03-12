import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["civil_erp"]
    expenses = await db.expenses.find().to_list(10)
    for exp in expenses:
        print(exp)

asyncio.run(check())
