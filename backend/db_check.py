import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    c = AsyncIOMotorClient('mongodb://localhost:27017')
    db = c.civil_erp
    print("Collections:", await db.list_collection_names())
    roles = await db.roles.find().to_list(length=10)
    for r in roles:
        print("Role Doc ID:", r.get("_id"))
    c.close()

if __name__ == "__main__":
    asyncio.run(check())
